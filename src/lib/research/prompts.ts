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
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`,
    )
    .join("\n\n");
}

/**
 * Build the per-topic user prompt.
 *
 * Assembles:
 * - Firm header including Companies House number (entity disambiguation — E6)
 * - Grounding context block (CH profile + procurement records)
 * - Tavily search results block
 * - Not-found sentinel instruction
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
  const chNumberNote = ctx.companiesHouseNumber
    ? ` (Companies House: ${ctx.companiesHouseNumber})`
    : "";

  const groundingBlock = `
=== Grounding Context (UK Structured Data — verified, confidence HIGH) ===
Firm: ${ctx.firmName}${chNumberNote}

${ctx.chSummary}

=== UK Procurement Records (top 10 by recency) ===
${ctx.procurementSummary}
`.trim();

  const searchBlock = formatSearchResults(searchResults);

  return `
## Firm: ${ctx.firmName}${chNumberNote}
## Topic: ${topic.name}

### Grounding Context (UK Structured Data — verified, confidence HIGH)
${groundingBlock}

### Web Search Results (Tavily — cite by URL, confidence MEDIUM)
${searchBlock}

### Instruction
Synthesise a finding for topic "${topic.name}" about ${ctx.firmName}.
If no reliable source supports a finding on this topic, respond with:
  summary: "Not found: <brief reason>"
  confidence: HIGH
  sourceUrl: "not-found"
  sourceTitle: "Research worker"
  rawSnippet: "No verifiable source found."
`.trim();
}
