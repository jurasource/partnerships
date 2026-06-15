/**
 * Collaboration extraction for cross-cutting analysis (PROF-07/ANAL-02).
 *
 * Reads the "Partnerships and JVs" finding for a firm and runs two LLM passes:
 *
 * 1. CollaborationExtractionSchema: extracts the culture-fit summary and upserts
 *    exactly one collaboration_records row per firm (explicit empty-state even when
 *    no evidence exists).
 *
 * 2. JVPartnershipsExtractionSchema: extracts explicitly announced JV partnerships,
 *    resolves named firms against the DB, and upserts partnership_pairs with
 *    partnershipType "jv".
 *
 * Always writes a collaboration_records row (never silent on missing data).
 * Unresolvable firm names in JV pairs are discarded (Pitfall 3).
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { generateText, Output, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

import { db } from "@/db/client";
import { collaborationRecords, partnershipPairs } from "@/db/schema";
import { findFindingByTopicName, TOPIC_NAMES } from "./topic-lookup";
import {
  CollaborationExtractionSchema,
  JVPartnershipsExtractionSchema,
} from "./schemas";
import { canonicalPair, resolveFirmName } from "./conflicts";

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const COLLABORATION_SYSTEM_PROMPT = `You are a structured data extraction assistant.

Your task is to extract collaboration and culture-fit information from a firm's research finding.

RULES:
1. Extract information about how the firm works with partners, their collaborative culture, and joint delivery track record.
2. Base the cultureFitSummary on information explicitly stated in the finding text only.
3. If there is no relevant collaboration or culture-fit information, set cultureFitSummary to null.
4. Copy sourceUrl, sourceTitle, and rawSnippet from the finding — do not fabricate.

Return a JSON object with: cultureFitSummary, sourceUrl, sourceTitle, rawSnippet.`;

const JV_EXTRACTION_SYSTEM_PROMPT = `You are a structured data extraction assistant.

Your task is to extract explicitly announced joint ventures (JVs) and formal partnerships from a firm's research finding.

RULES:
1. Extract ONLY JVs or formal partnerships that are explicitly announced or documented in the finding text.
2. Do NOT include informal collaborations, co-bidding history, or subcontracting arrangements.
3. Use the firm name exactly as it appears in the text — do not normalise.
4. If no explicit JV or formal partnership is mentioned, output an empty "partnerships" array.

Return a JSON object with a "partnerships" array. Each element must have:
- otherFirmName: exact name of the partner firm as written in the text
- evidenceSummary: 1-2 sentence summary of the JV/partnership
- sourceUrl: URL from the finding
- sourceTitle: title from the finding
- evidenceDate: date of announcement (ISO format) or null
- rawSnippet: verbatim excerpt evidencing the JV/partnership`;

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract collaboration record and JV partnership pairs for a firm.
 *
 * Always writes one collaboration_records row, even when no evidence exists
 * (explicit empty-state pattern). JV pairs are only written when evidence
 * can be resolved to real firms.
 *
 * @param firmId  ID of the firm to extract collaboration for
 */
export async function extractCollaboration(firmId: string): Promise<void> {
  // Read the "Partnerships and JVs" finding
  const finding = await findFindingByTopicName(firmId, TOPIC_NAMES.partnerships);

  // ---------------------------------------------------------------------------
  // Always write a collaboration_records row — explicit empty-state (Pitfall 4)
  // ---------------------------------------------------------------------------

  if (!finding || finding.sourceUrl === "not-found") {
    // No evidence available — write an explicit empty record
    await db
      .insert(collaborationRecords)
      .values({
        firmId,
        cultureFitSummary: null,
        sourceUrl: "not-found",
        sourceTitle: "Collaboration extraction — no data",
        rawSnippet: "No 'Partnerships and JVs' finding available for this firm.",
      })
      .onConflictDoUpdate({
        target: [collaborationRecords.firmId],
        set: {
          cultureFitSummary: null,
          sourceUrl: "not-found",
          sourceTitle: "Collaboration extraction — no data",
          rawSnippet: "No 'Partnerships and JVs' finding available for this firm.",
        },
      });

    return;
  }

  // ---------------------------------------------------------------------------
  // Pass 1: Extract culture-fit summary
  // ---------------------------------------------------------------------------

  let collaborationData: {
    cultureFitSummary: string | null;
    sourceUrl: string;
    sourceTitle: string;
    rawSnippet: string;
  } = {
    cultureFitSummary: null,
    sourceUrl: finding.sourceUrl,
    sourceTitle: finding.sourceTitle,
    rawSnippet: finding.rawSnippet,
  };

  console.log(`[collaboration] ${firmId} — Pass 1: culture-fit extraction`);

  let genFinishReason: string | undefined;
  let genInputTokens: number | undefined;
  let genOutputTokens: number | undefined;
  let genRawText: string | undefined;

  try {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: COLLABORATION_SYSTEM_PROMPT,
      prompt: `Extract collaboration and culture-fit information from this finding for firm ${firmId}:

Summary: ${finding.summary}
Source URL: ${finding.sourceUrl}
Source Title: ${finding.sourceTitle}
Raw Snippet: ${finding.rawSnippet}

Return a JSON object with cultureFitSummary, sourceUrl, sourceTitle, rawSnippet.`,
      output: Output.object({ schema: CollaborationExtractionSchema }),
      maxOutputTokens: 1024,
      temperature: 0.1,
      maxRetries: 2,
    });

    genFinishReason = result.finishReason;
    genInputTokens = result.usage?.inputTokens;
    genOutputTokens = result.usage?.outputTokens;
    genRawText = result.text;

    console.log(
      `[collaboration] ${firmId} Pass 1 — finishReason=${genFinishReason}, ` +
        `tokens in=${genInputTokens} out=${genOutputTokens}`,
    );

    if (result.output) {
      collaborationData = result.output;
    }
  } catch (err) {
    if (err instanceof NoObjectGeneratedError || err instanceof NoOutputGeneratedError) {
      const rawText = err instanceof NoObjectGeneratedError
        ? err.text?.slice(0, 500)
        : genRawText?.slice(0, 500);
      console.error(
        `[collaboration] ${err.constructor.name} on culture-fit for ${firmId} — ` +
          `finishReason=${genFinishReason ?? "unknown"}, ` +
          `tokens in=${genInputTokens ?? "?"} out=${genOutputTokens ?? "?"}, ` +
          `rawText="${rawText ?? "(none)"}"`,
      );
      // Fall through — use the default (finding metadata as fallback)
    } else {
      throw err;
    }
  }

  // Upsert the collaboration record
  await db
    .insert(collaborationRecords)
    .values({
      firmId,
      cultureFitSummary: collaborationData.cultureFitSummary,
      sourceUrl: collaborationData.sourceUrl,
      sourceTitle: collaborationData.sourceTitle,
      rawSnippet: collaborationData.rawSnippet,
    })
    .onConflictDoUpdate({
      target: [collaborationRecords.firmId],
      set: {
        cultureFitSummary: collaborationData.cultureFitSummary,
        sourceUrl: collaborationData.sourceUrl,
        sourceTitle: collaborationData.sourceTitle,
        rawSnippet: collaborationData.rawSnippet,
      },
    });

  // ---------------------------------------------------------------------------
  // Pass 2: Extract announced JV partnerships
  // ---------------------------------------------------------------------------

  console.log(`[collaboration] ${firmId} — Pass 2: JV partnership extraction`);

  let jvPartnerships: Array<{
    otherFirmName: string;
    evidenceSummary: string;
    sourceUrl: string;
    sourceTitle: string;
    evidenceDate: string | null;
    rawSnippet: string;
  }> = [];

  let jvFinishReason: string | undefined;
  let jvInputTokens: number | undefined;
  let jvOutputTokens: number | undefined;
  let jvRawText: string | undefined;

  try {
    const jvResult = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: JV_EXTRACTION_SYSTEM_PROMPT,
      prompt: `Extract explicitly announced JV partnerships from this finding for firm ${firmId}:

Summary: ${finding.summary}
Source URL: ${finding.sourceUrl}
Source Title: ${finding.sourceTitle}
Raw Snippet: ${finding.rawSnippet}

Return a JSON object with a "partnerships" array.`,
      output: Output.object({ schema: JVPartnershipsExtractionSchema }),
      maxOutputTokens: 1024,
      temperature: 0.1,
      maxRetries: 2,
    });

    jvFinishReason = jvResult.finishReason;
    jvInputTokens = jvResult.usage?.inputTokens;
    jvOutputTokens = jvResult.usage?.outputTokens;
    jvRawText = jvResult.text;

    console.log(
      `[collaboration] ${firmId} Pass 2 — finishReason=${jvFinishReason}, ` +
        `tokens in=${jvInputTokens} out=${jvOutputTokens}`,
    );

    jvPartnerships = jvResult.output?.partnerships ?? [];
  } catch (err) {
    if (err instanceof NoObjectGeneratedError || err instanceof NoOutputGeneratedError) {
      const rawText = err instanceof NoObjectGeneratedError
        ? err.text?.slice(0, 500)
        : jvRawText?.slice(0, 500);
      console.error(
        `[collaboration] ${err.constructor.name} on JV extraction for ${firmId} — ` +
          `finishReason=${jvFinishReason ?? "unknown"}, ` +
          `tokens in=${jvInputTokens ?? "?"} out=${jvOutputTokens ?? "?"}, ` +
          `rawText="${rawText ?? "(none)"}"`,
      );
      // No JV pairs to store — continue
    } else {
      throw err;
    }
  }

  console.log(
    `[collaboration] ${firmId} — ${jvPartnerships.length} JV candidate(s) to resolve`,
  );

  // ---------------------------------------------------------------------------
  // Persist JV partnership pairs
  // ---------------------------------------------------------------------------

  for (const jv of jvPartnerships) {
    // Resolve the partner firm's name to a DB ID (Pitfall 3)
    const counterpartId = await resolveFirmName(jv.otherFirmName);
    if (!counterpartId) {
      console.warn(
        `[collaboration] Discarding unresolvable JV partner: "${jv.otherFirmName}" (firmId=${firmId})`,
      );
      continue;
    }

    // Skip self-referential partnerships
    if (counterpartId === firmId) {
      continue;
    }

    // Enforce canonical pair ordering (Pitfall 2)
    const [firmAId, firmBId] = canonicalPair(firmId, counterpartId);

    await db
      .insert(partnershipPairs)
      .values({
        firmAId,
        firmBId,
        partnershipType: "jv",
        sourceType: "ai_research",
        sourceUrl: jv.sourceUrl,
        sourceTitle: jv.sourceTitle,
        evidenceSummary: jv.evidenceSummary,
        evidenceDate: jv.evidenceDate ?? null,
      })
      .onConflictDoUpdate({
        target: [
          partnershipPairs.firmAId,
          partnershipPairs.firmBId,
          partnershipPairs.partnershipType,
          partnershipPairs.sourceUrl,
        ],
        set: {
          evidenceSummary: jv.evidenceSummary,
          evidenceDate: jv.evidenceDate ?? null,
          sourceTitle: jv.sourceTitle,
        },
      });
  }
}
