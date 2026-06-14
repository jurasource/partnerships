import "server-only";

import { generateText, Output, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { findings, firms, topics } from "@/db/schema";
import type { WebSearchClient } from "@/lib/search/types";
import { FindingSchema, NOT_FOUND_SENTINEL, type SynthesisedFinding } from "./schemas";
import { buildGroundingContext } from "./grounding";
import { RESEARCH_SYSTEM_PROMPT, buildSearchQuery, buildTopicPrompt } from "./prompts";

/**
 * Per-firm research worker — the core of Phase 2 (AI-SPEC §4).
 *
 * Writes exactly one findings row per (firm × topic):
 * - A real, Zod-validated finding (confidence HIGH or MEDIUM), or
 * - An explicit "not found" sentinel (sourceUrl = 'not-found') rather than zero rows.
 *
 * Data-integrity guarantees (enforced in code, not just prompt):
 * - Citation completeness (E1): FindingSchema.min(1) rejects empty citation fields
 * - Explicit absence (E2): every topic loop writes at least one row (real or sentinel)
 * - No LOW confidence (no-LOW): FindingSchema enum is ['HIGH','MEDIUM'] only
 * - Citation-origin gate (E4): MEDIUM findings whose sourceUrl is not in retrieved
 *   Tavily URLs are coerced to the not-found sentinel
 *
 * The search client is dependency-injected (not imported directly) so its
 * invariants are unit-testable without live API keys.
 *
 * @param firmId       ID of the firm to research
 * @param jobId        ID of the research job (used for logging only — Wave 2 updates status)
 * @param searchClient Web search client implementing WebSearchClient interface (D-02)
 */
export async function runResearchWorker(
  firmId: string,
  jobId: string,
  searchClient: WebSearchClient,
): Promise<void> {
  // Load firm
  const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
  if (!firm) {
    throw new Error(`Firm not found: ${firmId}`);
  }

  // Build grounding context once for all topics (CH profile + top 10 OCDS records)
  const groundingContext = await buildGroundingContext(firm);

  // Read topics from the DB — do NOT use a hardcoded RESEARCH_TOPICS array
  // (topics live in the DB, seeded by src/db/seed.ts, 7 entries)
  const allTopics = await db.select().from(topics);

  // Sequential topic loop — intentionally NOT Promise.all (AI-SPEC §4b async design,
  // Anthropic rate limits, and partial-failure handling require sequential execution)
  for (const topic of allTopics) {
    let finding: SynthesisedFinding;

    // D-10: 1-2 Tavily searches per topic
    const searchResults = await searchClient.search(
      buildSearchQuery(firm.canonicalName, topic),
    );

    try {
      const result = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: RESEARCH_SYSTEM_PROMPT,
        prompt: buildTopicPrompt(topic, groundingContext, searchResults),
        output: Output.object({ schema: FindingSchema }),
        maxOutputTokens: 512, // structured extraction — 512 is sufficient (AI-SPEC §4)
        temperature: 0.1,     // near-deterministic for factual extraction
        maxRetries: 2,        // SDK-level retry on transient provider errors
      });

      if (!result.output) {
        // Schema validation passed but output is unexpectedly undefined
        console.warn(
          `[research] Empty output for ${firmId}/${topic.id} (job ${jobId})`,
        );
        finding = NOT_FOUND_SENTINEL(
          topic.id,
          "Schema validation passed but no structured output was produced",
        );
      } else {
        finding = result.output;
      }
    } catch (err) {
      if (err instanceof NoObjectGeneratedError) {
        // Model failed to produce schema-conforming output after maxRetries
        // Log raw output for debugging hallucination patterns; write sentinel so
        // topic is never silently absent (E2)
        console.error(
          `[research] NoObjectGeneratedError for ${firmId}/${topic.id}:`,
          (err as NoObjectGeneratedError).text?.slice(0, 500),
          String((err as NoObjectGeneratedError).cause),
        );
        finding = NOT_FOUND_SENTINEL(
          topic.id,
          "Model failed to produce structured output after retries",
        );
      } else {
        // Non-schema errors (network, auth, rate-limit) — re-throw so the Wave 2
        // route handler marks the job failed (D-05); partial findings are retained
        throw err;
      }
    }

    // Citation-origin gate (E4): a MEDIUM finding whose sourceUrl is not a member
    // of the retrieved Tavily result URLs is coerced to the not-found sentinel.
    // Prevents hallucinated/fabricated URLs from reaching the findings table.
    if (finding.confidence === "MEDIUM") {
      const retrievedUrls = new Set(searchResults.map((r) => r.url));
      if (!retrievedUrls.has(finding.sourceUrl)) {
        console.warn(
          `[research] Citation-origin gate rejection for ${firmId}/${topic.id}: ` +
            `sourceUrl "${finding.sourceUrl}" not in retrieved results`,
        );
        finding = NOT_FOUND_SENTINEL(
          topic.id,
          "sourceUrl not in retrieved Tavily results — possible hallucination",
        );
      }
    }

    // Persist the finding — upsert so re-runs replace stale rows rather than
    // accumulating duplicates (CR-03). The unique constraint on (firmId, topicId)
    // in schema.ts makes ON CONFLICT deterministic; createdAt is refreshed so
    // the status endpoint's "findings since startedAt" count stays accurate.
    await db.insert(findings).values({
      firmId,
      topicId: topic.id,
      summary: finding.summary,
      confidence: finding.confidence,
      sourceUrl: finding.sourceUrl,
      sourceTitle: finding.sourceTitle,
      rawSnippet: finding.rawSnippet,
    }).onConflictDoUpdate({
      target: [findings.firmId, findings.topicId],
      set: {
        summary: finding.summary,
        confidence: finding.confidence,
        sourceUrl: finding.sourceUrl,
        sourceTitle: finding.sourceTitle,
        rawSnippet: finding.rawSnippet,
        createdAt: sql`(datetime('now'))`,
      },
    });
  }
}
