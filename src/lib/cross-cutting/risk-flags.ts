/**
 * Risk flag extraction for cross-cutting analysis (PROF-05).
 *
 * Reads the three risk-related topic findings:
 *   - "Financial health"         → financial risk flags
 *   - "Regulatory approvals"     → regulatory risk flags
 *   - "Reputation and controversy" → reputational risk flags
 *
 * For each finding present, runs an LLM extraction pass using generateText +
 * Output.object (same pattern as worker.ts). Forces flagType per topic category
 * to prevent model confusion. Collects all flags, then atomically:
 *   1. Deletes all prior risk_flags rows for this firmId (Pitfall 1 — stale removal)
 *   2. Inserts the fresh flags in the same transaction
 *
 * NoObjectGeneratedError on one topic is caught and logged; other topics proceed.
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { generateText, Output, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { riskFlags } from "@/db/schema";
import { RiskFlagsExtractionSchema } from "./schemas";
import { findFindingByTopicName, TOPIC_NAMES } from "./topic-lookup";
import type { Finding } from "@/lib/types";

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const RISK_EXTRACTION_SYSTEM_PROMPT = `You are a risk analyst extracting structured risk flags from cached research findings about a company.

Your job is to extract ONLY risk flags that are EXPLICITLY stated in the provided finding text with a cited source.

Rules:
- Extract only risks that are explicitly stated — do NOT infer or extrapolate
- Assign severity: High (material threat to firm viability/consortium suitability), Medium (notable concern), Low (minor issue)
- Copy sourceUrl, sourceTitle, and sourceDate from the finding data exactly — do not fabricate URLs
- Copy the most relevant verbatim excerpt as rawSnippet
- Output an empty array if no risk is explicitly stated with a verifiable source
- If the finding is a "not found" sentinel (sourceUrl = "not-found"), always output an empty array`;

function buildRiskExtractionPrompt(
  finding: Finding,
  topicName: string,
): string {
  return `Extract risk flags from the following research finding about a company.

Topic: ${topicName}
Finding summary: ${finding.summary}
Source URL: ${finding.sourceUrl}
Source title: ${finding.sourceTitle}
Source date: ${finding.sourceDate ?? "not provided"}
Raw snippet: ${finding.rawSnippet}

Extract all risk flags explicitly evidenced in the above text. Output an empty array if no risk is stated.`;
}

// ---------------------------------------------------------------------------
// Topic → flagType mapping
// ---------------------------------------------------------------------------

const TOPIC_TO_FLAG_TYPE: Record<
  string,
  "financial" | "reputational" | "regulatory"
> = {
  [TOPIC_NAMES.financial]: "financial",
  [TOPIC_NAMES.regulatory]: "regulatory",
  [TOPIC_NAMES.reputation]: "reputational",
};

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract and persist risk flags for a firm.
 *
 * Reads three risk topic findings, runs LLM extraction per topic, then
 * atomically deletes stale flags and inserts fresh ones in a transaction.
 *
 * @param firmId  ID of the firm to extract risk flags for
 */
export async function extractRiskFlags(firmId: string): Promise<void> {
  const riskTopics = [
    { topicName: TOPIC_NAMES.financial, flagType: "financial" as const },
    { topicName: TOPIC_NAMES.regulatory, flagType: "regulatory" as const },
    { topicName: TOPIC_NAMES.reputation, flagType: "reputational" as const },
  ];

  // Collect all extracted flags across all three topics
  const allFlags: Array<{
    firmId: string;
    flagType: "financial" | "reputational" | "regulatory";
    severity: "High" | "Medium" | "Low";
    description: string;
    sourceUrl: string;
    sourceTitle: string;
    sourceDate: string | null;
    rawSnippet: string;
  }> = [];

  for (const { topicName, flagType } of riskTopics) {
    const finding = await findFindingByTopicName(firmId, topicName);

    // Skip topic if no finding exists or if it's a "not found" sentinel
    if (!finding || finding.sourceUrl === "not-found") {
      console.log(`[risk-flags] ${firmId}/${topicName} — no finding, skipping`);
      continue;
    }

    console.log(`[risk-flags] ${firmId}/${topicName} — calling generateText`);

    // Capture diagnostics before accessing result.output (which can throw NoOutputGeneratedError)
    let genFinishReason: string | undefined;
    let genInputTokens: number | undefined;
    let genOutputTokens: number | undefined;
    let genRawText: string | undefined;

    try {
      const result = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: RISK_EXTRACTION_SYSTEM_PROMPT,
        prompt: buildRiskExtractionPrompt(finding, topicName),
        output: Output.object({ schema: RiskFlagsExtractionSchema }),
        maxOutputTokens: 1024,
        temperature: 0.1,
        maxRetries: 2,
      });

      genFinishReason = result.finishReason;
      genInputTokens = result.usage?.inputTokens;
      genOutputTokens = result.usage?.outputTokens;
      genRawText = result.text;

      console.log(
        `[risk-flags] ${firmId}/${topicName} — finishReason=${genFinishReason}, ` +
          `tokens in=${genInputTokens} out=${genOutputTokens}`,
      );

      if (!result.output) {
        console.warn(
          `[risk-flags] Empty output for ${firmId}/${topicName} — skipping`,
        );
        continue;
      }

      // Force flagType per topic — do NOT trust the model's flagType field (T-04-01)
      const topicFlags = result.output.flags.map((flag) => ({
        firmId,
        flagType, // forced, not from LLM
        severity: flag.severity,
        description: flag.description,
        sourceUrl: flag.sourceUrl,
        sourceTitle: flag.sourceTitle,
        sourceDate: flag.sourceDate ?? null,
        rawSnippet: flag.rawSnippet,
      }));

      console.log(
        `[risk-flags] ${firmId}/${topicName} — extracted ${topicFlags.length} flag(s)`,
      );
      allFlags.push(...topicFlags);
    } catch (err) {
      if (err instanceof NoObjectGeneratedError || err instanceof NoOutputGeneratedError) {
        const rawText = err instanceof NoObjectGeneratedError
          ? err.text?.slice(0, 500)
          : genRawText?.slice(0, 500);
        console.error(
          `[risk-flags] ${err.constructor.name} for ${firmId}/${topicName} — ` +
            `finishReason=${genFinishReason ?? "unknown"}, ` +
            `tokens in=${genInputTokens ?? "?"} out=${genOutputTokens ?? "?"}, ` +
            `rawText="${rawText ?? "(none)"}"`,
        );
        continue;
      }
      // Non-schema errors (network, auth, rate-limit) — re-throw
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Atomic delete-then-insert (T-04-02 / Pitfall 1 — stale flag removal)
  // ---------------------------------------------------------------------------
  await db.transaction(async (tx) => {
    // Always delete prior flags — even if no new flags extracted
    // (covers the case where research refresh finds zero risks)
    await tx.delete(riskFlags).where(eq(riskFlags.firmId, firmId));

    if (allFlags.length > 0) {
      await tx.insert(riskFlags).values(allFlags);
    }
  });
}
