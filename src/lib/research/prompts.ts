/**
 * Prompt builders for the research worker.
 *
 * System vs user prompt separation (AI-SPEC §4b Prompt Engineering):
 * - RESEARCH_SYSTEM_PROMPT: persona, rules, output contract — fixed per worker run
 * - buildTopicPrompt: per-topic grounding context + instruction — varies per call
 *
 * Entity disambiguation (E6): the Companies House number is included in the firm
 * header to prevent the model from attributing sibling/predecessor entity claims.
 */

import type { WebSearchResult } from "@/lib/search/types";
import type { GroundingContext } from "./grounding";
import type { Topic } from "@/lib/types";

export const RESEARCH_SYSTEM_PROMPT = `
You are a UK firm intelligence analyst supporting bid/consortium planning for civil nuclear and defence programmes.

Your task is to synthesise findings about a specific firm on a specific topic, drawing on:
1. Verified UK structured data (Companies House profile, PSC register, UK procurement records) provided in the grounding context.
2. Web search results provided below.

Output rules (enforced by schema — do not deviate):
- confidence HIGH: use only when the finding is drawn directly from the provided structured UK API data. Set sourceUrl to the data source identifier.
- confidence MEDIUM: use when the finding is AI-derived from a cited Tavily search result. sourceUrl MUST be a real URL from the provided search results — not invented.
- Never fabricate sourceUrl, sourceTitle, or rawSnippet. If you cannot attribute a finding to a provided source, emit the not-found sentinel pattern described in the user prompt.
- rawSnippet must be a verbatim excerpt from the source, not a paraphrase.
- Never emit LOW confidence — use the not-found sentinel pattern instead.
- citations: populate with all Tavily result URLs you used to synthesise this finding (may overlap with sourceUrl). Set citations to an empty array for HIGH-confidence structured data or the not-found sentinel.
`.trim();

/**
 * Build a Tavily search query for a firm and topic.
 *
 * Includes firm name, topic name, and "UK nuclear defence" context for relevance
 * (AI-SPEC §4 Tool Use — query template).
 */
export function buildSearchQuery(firmName: string, topic: Topic): string {
  return `${firmName} ${topic.name} UK nuclear defence`;
}

/**
 * Format Tavily search results as a numbered list for the AI prompt.
 * Each result includes URL, title, and snippet.
 */
export function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return "No search results found.";
  }

  return results
    .map((r, i) => {
      const dateLine = r.publishedDate ? `\nPublished: ${r.publishedDate}` : "";
      return `[${i + 1}] ${r.title}\nURL: ${r.url}${dateLine}\nSnippet: ${r.snippet}`;
    })
    .join("\n\n");
}

/**
 * Build the stable grounding prefix for a firm — identical across all 7 topic calls.
 *
 * This is the cacheable block for Anthropic prompt caching: it contains the firm
 * header and all structured UK data (CH profile + procurement records) that does
 * not change between topics. A cache_control marker is applied to this block in
 * the worker so Anthropic caches everything up to and including this prefix.
 *
 * @param ctx  Grounding context (CH + OCDS data)
 */
export function buildGroundingBlock(ctx: GroundingContext): string {
  const chNumberNote = ctx.companiesHouseNumber
    ? ` (Companies House: ${ctx.companiesHouseNumber})`
    : "";

  return `
## Firm: ${ctx.firmName}${chNumberNote}

### Grounding Context (UK Structured Data — verified, confidence HIGH)
=== Grounding Context (UK Structured Data — verified, confidence HIGH) ===
Firm: ${ctx.firmName}${chNumberNote}

${ctx.chSummary}

=== UK Procurement Records (top 10 by recency) ===
${ctx.procurementSummary}
`.trim();
}

/**
 * Build the per-topic suffix — changes every call, so never cached.
 *
 * Contains the topic header, Tavily search results, and synthesis instruction.
 * Appended after the cached grounding block in the worker's messages array.
 *
 * @param topic         The research topic
 * @param searchResults Tavily search results for this topic
 * @param firmName      Canonical firm name (for the instruction line)
 */
export function buildTopicBlock(
  topic: Topic,
  searchResults: WebSearchResult[],
  firmName: string,
): string {
  const searchBlock = formatSearchResults(searchResults);

  return `
## Topic: ${topic.name}

### Web Search Results (Tavily — cite by URL, confidence MEDIUM)
${searchBlock}

### Instruction
Synthesise a finding for topic "${topic.name}" about ${firmName}.
If no reliable source supports a finding on this topic, respond with:
  summary: "Not found: <brief reason>"
  confidence: HIGH
  sourceUrl: "not-found"
  sourceTitle: "Research worker"
  rawSnippet: "No verifiable source found."
`.trim();
}

/**
 * Build the complete per-topic user prompt (grounding + topic blocks joined).
 *
 * Kept as a convenience wrapper so existing tests and callers that pass the
 * combined prompt as a single string continue to work unchanged.
 *
 * @param topic         The research topic
 * @param ctx           Grounding context (CH + OCDS data)
 * @param searchResults Tavily search results for this topic
 */
export function buildTopicPrompt(
  topic: Topic,
  ctx: GroundingContext,
  searchResults: WebSearchResult[],
): string {
  return `${buildGroundingBlock(ctx)}\n\n${buildTopicBlock(topic, searchResults, ctx.firmName)}`;
}
