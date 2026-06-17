import { generateText, Output, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { findings, firms, topics, requestLogs } from "@/db/schema";
import type { WebSearchClient } from "@/lib/search/types";
import { FindingSchema, NOT_FOUND_SENTINEL, RESEARCH_ERROR_SENTINEL, type SynthesisedFinding } from "./schemas";
import { buildGroundingContext } from "./grounding";
import { RESEARCH_SYSTEM_PROMPT, buildSearchQuery, buildGroundingBlock, buildTopicBlock } from "./prompts";

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

  // Pre-compute the grounding block once — stable across all 7 topic calls.
  // Placed in the system array (not user messages) so that injectJsonInstructionIntoMessages,
  // which Output.object uses to inject JSON instructions into user messages, cannot
  // displace the cache breakpoint.
  const groundingBlock = buildGroundingBlock(groundingContext);

  // System message pair: persona/rules first, then grounding context marked as the
  // cache breakpoint. Anthropic caches everything up to and including the block that
  // carries cacheControl, so both blocks are cached together.
  const systemWithGrounding = [
    { role: "system" as const, content: RESEARCH_SYSTEM_PROMPT },
    {
      role: "system" as const,
      content: groundingBlock,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" as const } },
      },
    },
  ];

  // Sequential topic loop — intentionally NOT Promise.all (AI-SPEC §4b async design,
  // Anthropic rate limits, and partial-failure handling require sequential execution)
  for (let i = 0; i < allTopics.length; i++) {
    const topic = allTopics[i];
    await onProgress?.(`Topic ${i + 1}/${allTopics.length}: ${topic.name}`);
    let finding: SynthesisedFinding;

    // D-10: 1-2 Tavily searches per topic
    const searchQuery = buildSearchQuery(firm.canonicalName, topic);
    const searchStart = Date.now();
    let searchResults: ReturnType<typeof searchClient.search> extends Promise<infer T> ? T : never = [];
    let searchError: string | undefined;
    try {
      searchResults = await searchClient.search(searchQuery);
    } catch (err) {
      searchError = (err as Error).message;
      void writeLog({
        type: "tavily_search",
        jobId,
        firmId,
        topicId: topic.id,
        searchQuery,
        searchResultsJson: null,
        durationMs: String(Date.now() - searchStart),
        errorMessage: searchError,
      });
      throw err;
    }
    void writeLog({
      type: "tavily_search",
      jobId,
      firmId,
      topicId: topic.id,
      searchQuery,
      searchResultsJson: JSON.stringify(searchResults),
      durationMs: String(Date.now() - searchStart),
      errorMessage: null,
    });

    console.log(
      `[research] Topic ${i + 1}/${allTopics.length} "${topic.name}" — ` +
        `${searchResults.length} search results, calling generateText`,
    );

    // Held outside try so the catch block can log finishReason/tokens/rawText
    // even when the error is thrown by the result.output getter (not generateText itself)
    let genFinishReason: string | undefined;
    let genInputTokens: number | undefined;
    let genOutputTokens: number | undefined;
    let genRawText: string | undefined;

    // Messages array — per-topic content only. The stable grounding prefix lives in
    // the system array below (see `systemWithGrounding`) so that injectJsonInstructionIntoMessages
    // (used by Output.object) cannot displace the cache breakpoint.
    const messages = [
      {
        role: "user" as const,
        content: buildTopicBlock(topic, searchResults, groundingContext.firmName),
      },
    ];

    try {
      const llmStart = Date.now();
      let result = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: systemWithGrounding,
        messages,
        output: Output.object({ schema: FindingSchema }),
        maxOutputTokens: 2048,
        temperature: 0.1,
        maxRetries: 2,
      });

      // Capture diagnostics before accessing result.output, which can throw
      genFinishReason = result.finishReason;
      genInputTokens = result.usage?.inputTokens;
      genOutputTokens = result.usage?.outputTokens;
      genRawText = result.text;

      const cacheMeta = result.providerMetadata?.anthropic as {
        cacheCreationInputTokens?: number;
        cacheReadInputTokens?: number;
      } | undefined;
      console.log(
        `[research] generateText: finishReason=${result.finishReason}, ` +
          `tokens in=${result.usage?.inputTokens} out=${result.usage?.outputTokens}, ` +
          `cache created=${cacheMeta?.cacheCreationInputTokens ?? 0} read=${cacheMeta?.cacheReadInputTokens ?? 0}`,
      );

      void writeLog({
        type: "llm_call",
        jobId,
        firmId,
        topicId: topic.id,
        model: "claude-sonnet-4-6",
        promptJson: JSON.stringify({ system: systemWithGrounding, messages }),
        rawResponse: result.text,
        inputTokens: String(result.usage?.inputTokens ?? ""),
        outputTokens: String(result.usage?.outputTokens ?? ""),
        cacheCreatedTokens: String(cacheMeta?.cacheCreationInputTokens ?? 0),
        cacheReadTokens: String(cacheMeta?.cacheReadInputTokens ?? 0),
        finishReason: result.finishReason,
        isRetry: "false",
        durationMs: String(Date.now() - llmStart),
        errorMessage: null,
      });

      // Retry with a higher ceiling when the response was truncated mid-JSON
      if (result.finishReason === "length") {
        console.warn(
          `[research] finishReason=length for "${topic.name}" — retrying with 4096 output tokens`,
        );
        const retryStart = Date.now();
        result = await generateText({
          model: anthropic("claude-sonnet-4-6"),
          system: systemWithGrounding,
          messages,
          output: Output.object({ schema: FindingSchema }),
          maxOutputTokens: 4096,
          temperature: 0.1,
          maxRetries: 2,
        });
        genFinishReason = result.finishReason;
        genInputTokens = result.usage?.inputTokens;
        genOutputTokens = result.usage?.outputTokens;
        genRawText = result.text;
        const retryMeta = result.providerMetadata?.anthropic as {
          cacheCreationInputTokens?: number;
          cacheReadInputTokens?: number;
        } | undefined;
        console.log(
          `[research] retry generateText: finishReason=${result.finishReason}, ` +
            `tokens in=${result.usage?.inputTokens} out=${result.usage?.outputTokens}, ` +
            `cache created=${retryMeta?.cacheCreationInputTokens ?? 0} read=${retryMeta?.cacheReadInputTokens ?? 0}`,
        );

        void writeLog({
          type: "llm_call",
          jobId,
          firmId,
          topicId: topic.id,
          model: "claude-sonnet-4-6",
          promptJson: JSON.stringify({ system: systemWithGrounding, messages }),
          rawResponse: result.text,
          inputTokens: String(result.usage?.inputTokens ?? ""),
          outputTokens: String(result.usage?.outputTokens ?? ""),
          cacheCreatedTokens: String(retryMeta?.cacheCreationInputTokens ?? 0),
          cacheReadTokens: String(retryMeta?.cacheReadInputTokens ?? 0),
          finishReason: result.finishReason,
          isRetry: "true",
          durationMs: String(Date.now() - retryStart),
          errorMessage: null,
        });
      }

      if (!result.output) {
        console.warn(
          `[research] Empty output for ${firmId}/${topic.id} (job ${jobId})`,
        );
        finding = RESEARCH_ERROR_SENTINEL(
          topic.id,
          "Schema validation passed but no structured output was produced",
        );
      } else {
        finding = result.output;
      }
    } catch (err) {
      if (err instanceof NoObjectGeneratedError || err instanceof NoOutputGeneratedError) {
        // NoObjectGeneratedError: model produced output but it failed schema validation after retries
        // NoOutputGeneratedError: truncated JSON (finishReason=length) that couldn't be parsed
        const rawText = err instanceof NoObjectGeneratedError
          ? err.text?.slice(0, 500)
          : genRawText?.slice(0, 500);
        console.error(
          `[research] ${err.constructor.name} for "${topic.name}" — ` +
            `finishReason=${genFinishReason ?? "unknown"}, ` +
            `tokens in=${genInputTokens ?? "?"} out=${genOutputTokens ?? "?"}, ` +
            `rawText="${rawText ?? "(none)"}"`,
        );
        void writeLog({
          type: "llm_call",
          jobId,
          firmId,
          topicId: topic.id,
          model: "claude-sonnet-4-6",
          promptJson: JSON.stringify({ system: systemWithGrounding, messages }),
          rawResponse: rawText ?? null,
          inputTokens: String(genInputTokens ?? ""),
          outputTokens: String(genOutputTokens ?? ""),
          finishReason: genFinishReason ?? "error",
          isRetry: null,
          durationMs: null,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        finding = RESEARCH_ERROR_SENTINEL(
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
        void writeLog({
          type: "llm_call",
          jobId,
          firmId,
          topicId: topic.id,
          model: "claude-sonnet-4-6",
          promptJson: JSON.stringify({ system: systemWithGrounding, messages }),
          rawResponse: genRawText ?? null,
          inputTokens: String(genInputTokens ?? ""),
          outputTokens: String(genOutputTokens ?? ""),
          finishReason: "error",
          isRetry: null,
          durationMs: null,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
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
    const searchResultsJson = JSON.stringify(searchResults);
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
      searchResults: searchResultsJson,
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
        searchResults: searchResultsJson,
        createdAt: new Date().toISOString(),
      },
    });
  }
}

/**
 * Fire-and-forget helper — writes one row to request_logs.
 * A failure here must NEVER propagate; logging is best-effort.
 */
async function writeLog(
  entry: Partial<typeof requestLogs.$inferInsert> & { type: "tavily_search" | "llm_call" },
): Promise<void> {
  try {
    await db.insert(requestLogs).values({
      ...entry,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[request-log] Failed to write log entry:", err);
  }
}
