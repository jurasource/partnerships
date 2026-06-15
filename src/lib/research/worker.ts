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
 * @param onProgress   Optional callback invoked at the start of each topic with a progress label
 */
export async function runResearchWorker(
  firmId: string,
  jobId: string,
  searchClient: WebSearchClient,
  onProgress?: (message: string) => Promise<void>,
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

  console.log(
    `[research] Starting worker for firm "${firm.canonicalName}" (${firmId}), ` +
      `job ${jobId}, ${allTopics.length} topics`,
  );

  // Sequential topic loop — intentionally NOT Promise.all (AI-SPEC §4b async design,
  // Anthropic rate limits, and partial-failure handling require sequential execution)
  for (let i = 0; i < allTopics.length; i++) {
    const topic = allTopics[i];
    await onProgress?.(`Topic ${i + 1}/${allTopics.length}: ${topic.name}`);
    let finding: SynthesisedFinding;

    // D-10: 1-2 Tavily searches per topic
    const searchResults = await searchClient.search(
      buildSearchQuery(firm.canonicalName, topic),
    );

    console.log(
      `[research] Topic ${i + 1}/${allTopics.length} "${topic.name}" — ` +
        `${searchResults.length} search results, calling generateText`,
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
        console.error(
          `[research] Fatal error on topic "${topic.name}" (${firmId}/${topic.id}): ` +
            `${(err as Error).constructor?.name ?? "Error"}: ${(err as Error).message}`,
          err instanceof Error ? err.stack : err,
        );
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
      } else {
        // Filter supporting citations to only URLs actually retrieved (E4 extension)
        finding = {
          ...finding,
          citations: (finding.citations ?? []).filter((c) => retrievedUrls.has(c.url)),
        };
      }
    }

    console.log(
      `[research] Topic "${topic.name}" → confidence=${finding.confidence} ` +
        `sourceUrl=${finding.sourceUrl.slice(0, 60)}`,
    );

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
      sourceDate: finding.sourceDate ?? null,
      citations: JSON.stringify(finding.citations ?? []),
    }).onConflictDoUpdate({
      target: [findings.firmId, findings.topicId],
      set: {
        summary: finding.summary,
        confidence: finding.confidence,
        sourceUrl: finding.sourceUrl,
        sourceTitle: finding.sourceTitle,
        rawSnippet: finding.rawSnippet,
        sourceDate: finding.sourceDate ?? null,
        citations: JSON.stringify(finding.citations ?? []),
        createdAt: new Date().toISOString(),
      },
    });
  }
}
