/**
 * Conflict pair extraction for cross-cutting analysis (ANAL-01).
 *
 * Reads "Partnerships and JVs" and "Reputation and controversy" findings for a firm,
 * runs LLM extraction to identify explicit audit/competitor conflicts with named evidence,
 * resolves firm names against the firms table, and upserts conflict_pairs with
 * canonical ordering (firmAId < firmBId lexicographically).
 *
 * Key invariants:
 * - Only explicitly evidenced conflicts are stored (never fabricated — Pitfall 3)
 * - Unresolvable firm names are silently discarded (T-04-04 mitigation)
 * - Canonical pair ordering prevents duplicate pairs from both firms' extraction runs (Pitfall 2)
 * - NoObjectGeneratedError is caught per-finding (partial failure graceful)
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { generateText, Output, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { firms, conflictPairs } from "@/db/schema";
import { findFindingByTopicName, TOPIC_NAMES } from "./topic-lookup";
import { ConflictsExtractionSchema } from "./schemas";

// ---------------------------------------------------------------------------
// Helper: canonical pair ordering
// ---------------------------------------------------------------------------

/**
 * Returns [id1, id2] ordered lexicographically (id1 <= id2).
 * Ensures conflict_pairs and partnership_pairs have exactly one canonical row
 * per pair regardless of which firm triggers the extraction (Pitfall 2).
 *
 * @example
 *   canonicalPair("firm-zebra", "firm-aardvark") → ["firm-aardvark", "firm-zebra"]
 */
export function canonicalPair(id1: string, id2: string): [string, string] {
  return id1 <= id2 ? [id1, id2] : [id2, id1];
}

// ---------------------------------------------------------------------------
// Helper: firm name resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a firm name (canonical name or alias) to a firm ID.
 *
 * Checks `firms.canonicalName` first (case-insensitive), then each entry in
 * `firms.aliases` (JSON array of strings, parsed in JS).
 *
 * Returns the firm's ID if found, or null if the name cannot be resolved
 * (triggering Pitfall 3 discard — prevents fabricated names reaching the DB).
 *
 * @param name  Firm name as returned by the LLM
 */
export async function resolveFirmName(name: string): Promise<string | null> {
  const allFirms = await db.select().from(firms);

  const nameLower = name.toLowerCase().trim();

  for (const firm of allFirms) {
    // Check canonical name
    if (firm.canonicalName.toLowerCase().trim() === nameLower) {
      return firm.id;
    }

    // Check aliases (stored as JSON array of strings)
    try {
      const aliases = JSON.parse(firm.aliases) as string[];
      if (Array.isArray(aliases)) {
        for (const alias of aliases) {
          if (typeof alias === "string" && alias.toLowerCase().trim() === nameLower) {
            return firm.id;
          }
        }
      }
    } catch {
      // Malformed aliases JSON — skip this firm's aliases
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// System prompt for conflict extraction
// ---------------------------------------------------------------------------

const CONFLICT_EXTRACTION_SYSTEM_PROMPT = `You are a structured data extraction assistant.

Your task is to identify explicit conflict-of-interest relationships between firms from a given finding text.

RULES:
1. Extract ONLY conflicts that are explicitly stated in the finding text with named firms and specific evidence.
2. DO NOT infer, extrapolate, or assume conflicts that are not directly stated.
3. DO NOT fabricate firm names. Use the firm name exactly as it appears in the text.
4. If no explicit conflict evidence exists, output an empty "conflicts" array.
5. A conflict must be one of:
   - "audit": one firm audits or has audited the other (conflict of interest for joint delivery)
   - "competitor": the two firms directly compete for the same contracts or market segments

Return a JSON object with a "conflicts" array. Each element must have:
- otherFirmName: the exact firm name from the text
- conflictType: "audit" or "competitor"
- evidenceSummary: 1-2 sentence summary grounded in the text
- sourceUrl: copy from the finding's sourceUrl
- sourceTitle: copy from the finding's sourceTitle
- rawSnippet: verbatim excerpt that evidences the conflict`;

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract conflict pairs for a firm by reading its "Partnerships and JVs" and
 * "Reputation and controversy" findings, running LLM extraction, resolving firm
 * names against the DB, and upserting canonical conflict_pairs rows.
 *
 * Empty findings and unresolvable names produce no DB rows (never fabricates).
 *
 * @param firmId  ID of the firm to extract conflicts for
 */
export async function extractConflicts(firmId: string): Promise<void> {
  // Read both findings that may contain conflict evidence
  const [partnershipsFinding, reputationFinding] = await Promise.all([
    findFindingByTopicName(firmId, TOPIC_NAMES.partnerships),
    findFindingByTopicName(firmId, TOPIC_NAMES.reputation),
  ]);

  const findingsToProcess = [partnershipsFinding, reputationFinding].filter(
    (f): f is NonNullable<typeof f> =>
      f !== null && f.sourceUrl !== "not-found",
  );

  if (findingsToProcess.length === 0) {
    console.log(`[conflicts] ${firmId} — no real findings to process`);
    return;
  }

  // Run LLM extraction for each relevant finding
  for (const finding of findingsToProcess) {
    console.log(`[conflicts] ${firmId}/${finding.topicId} — calling generateText`);

    let extraction: { conflicts: Array<{
      otherFirmName: string;
      conflictType: "audit" | "competitor";
      evidenceSummary: string;
      sourceUrl: string;
      sourceTitle: string;
      rawSnippet: string;
    }> } | null = null;

    let genFinishReason: string | undefined;
    let genInputTokens: number | undefined;
    let genOutputTokens: number | undefined;
    let genRawText: string | undefined;

    try {
      const result = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: CONFLICT_EXTRACTION_SYSTEM_PROMPT,
        prompt: `Extract conflict relationships from this finding for firm ${firmId}:

Topic: ${finding.topicId}
Summary: ${finding.summary}
Source URL: ${finding.sourceUrl}
Source Title: ${finding.sourceTitle}
Raw Snippet: ${finding.rawSnippet}

Return conflicts as a JSON object with a "conflicts" array.`,
        output: Output.object({ schema: ConflictsExtractionSchema }),
        maxOutputTokens: 1024,
        temperature: 0.1,
        maxRetries: 2,
      });

      genFinishReason = result.finishReason;
      genInputTokens = result.usage?.inputTokens;
      genOutputTokens = result.usage?.outputTokens;
      genRawText = result.text;

      console.log(
        `[conflicts] ${firmId}/${finding.topicId} — finishReason=${genFinishReason}, ` +
          `tokens in=${genInputTokens} out=${genOutputTokens}`,
      );

      extraction = result.output ?? null;
    } catch (err) {
      if (err instanceof NoObjectGeneratedError || err instanceof NoOutputGeneratedError) {
        const rawText = err instanceof NoObjectGeneratedError
          ? err.text?.slice(0, 500)
          : genRawText?.slice(0, 500);
        console.error(
          `[conflicts] ${err.constructor.name} for ${firmId}/${finding.topicId} — ` +
            `finishReason=${genFinishReason ?? "unknown"}, ` +
            `tokens in=${genInputTokens ?? "?"} out=${genOutputTokens ?? "?"}, ` +
            `rawText="${rawText ?? "(none)"}"`,
        );
        continue;
      }
      throw err;
    }

    if (!extraction || extraction.conflicts.length === 0) {
      console.log(`[conflicts] ${firmId}/${finding.topicId} — no conflicts found`);
      continue;
    }

    console.log(
      `[conflicts] ${firmId}/${finding.topicId} — ${extraction.conflicts.length} candidate(s) to resolve`,
    );

    // Process each extracted conflict
    for (const conflict of extraction.conflicts) {
      // Resolve the other firm's name to a DB ID (Pitfall 3 — discard fabricated names)
      const counterpartId = await resolveFirmName(conflict.otherFirmName);
      if (!counterpartId) {
        console.warn(
          `[conflicts] Discarding unresolvable firm name: "${conflict.otherFirmName}" (firmId=${firmId})`,
        );
        continue;
      }

      // Skip self-referential conflicts
      if (counterpartId === firmId) {
        continue;
      }

      // Enforce canonical ordering (Pitfall 2)
      const [firmAId, firmBId] = canonicalPair(firmId, counterpartId);

      await db
        .insert(conflictPairs)
        .values({
          firmAId,
          firmBId,
          conflictType: conflict.conflictType,
          evidenceSummary: conflict.evidenceSummary,
          sourceUrl: conflict.sourceUrl,
          sourceTitle: conflict.sourceTitle,
          rawSnippet: conflict.rawSnippet,
        })
        .onConflictDoUpdate({
          target: [conflictPairs.firmAId, conflictPairs.firmBId, conflictPairs.conflictType],
          set: {
            evidenceSummary: conflict.evidenceSummary,
            sourceUrl: conflict.sourceUrl,
            sourceTitle: conflict.sourceTitle,
            rawSnippet: conflict.rawSnippet,
          },
        });
    }
  }
}
