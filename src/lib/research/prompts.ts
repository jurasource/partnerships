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
You are a UK firm intelligence analyst supporting bid/consortium planning for civil nuclear programmes.

Your task is to synthesise findings about a specific firm on a specific topic, drawing on:
1. Verified UK structured data (Companies House profile, PSC register, UK procurement records) provided in the grounding context.
2. Web search results provided below.

## Output schema (all fields required)

Your response must be a single JSON object matching this schema exactly:

{
  "confidence": "HIGH" | "MEDIUM",
  "summary": string,        // 1–3 sentence synthesis of the finding
  "sourceUrl": string,      // URL of the primary source, or "not-found"
  "sourceTitle": string,    // Human-readable title of the primary source
  "rawSnippet": string,     // Verbatim excerpt from the source (not a paraphrase)
  "sourceDate": string | null, // ISO date of the source if available, else null
  "citations": [            // All supporting sources used
    {
      "url": string,
      "title": string,
      "snippet": string,
      "date": string | null  // ISO date or year string if available, else null
    }
  ]
}

## Confidence rules

confidence HIGH — use exclusively when the finding is drawn directly from the verified structured UK data provided in the grounding context (Companies House profile, PSC register, procurement records). Set sourceUrl to the relevant data source identifier.

confidence MEDIUM — use when the finding is AI-derived from a cited Tavily web search result. sourceUrl MUST be a real URL taken verbatim from the provided search results. Do not invent, shorten, or paraphrase URLs.

Never emit LOW confidence. If you cannot support a finding at MEDIUM or HIGH, emit the not-found sentinel (see below).

## Citation rules

- rawSnippet must be a verbatim excerpt from the primary source — never a paraphrase or AI-generated summary.
- citations must list every Tavily URL you drew on to synthesise this finding. It may be empty for HIGH-confidence structured data or the not-found sentinel, but must not omit any source actually used.
- Never fabricate sourceUrl, sourceTitle, rawSnippet, or any citation URL. If a URL is not in the provided search results, it must not appear in your output.

## Not-found sentinel

When no reliable source supports a finding on the requested topic, output exactly:
  summary: "Not found: <brief reason>"
  confidence: HIGH
  sourceUrl: "not-found"
  sourceTitle: "Research worker"
  rawSnippet: "No verifiable source found."
  sourceDate: null
  citations: []

## Entity disambiguation

The grounding context includes the firm's Companies House registration number. Use it to avoid attributing claims about sibling entities, predecessor companies, or similarly named firms to the target entity.

## Topic guidance

UK nuclear capability — look for nuclear-licensed sites, reactor or decommissioning contracts, NDA supply-chain membership, ONR licensing status, nuclear-qualified staff or facilities.

Past government contracts — look for DESNZ, NDA, BEIS, or other central-government contract awards. Prioritise contracts with values and dates; note whether the firm was prime or sub-contractor.

Ownership structure — derive from the Companies House PSC register. Identify ultimate beneficial owners and flag any non-UK ownership or foreign state links. Note holding-company chains.

Financial health — look for recent accounts filed at Companies House, credit ratings, turnover, profit, or analyst commentary. Note any CCJs, insolvency events, or going-concern caveats.

Partnerships and JVs — look for named joint ventures, teaming agreements, consortium memberships, or framework lots shared with named partners.

Regulatory approvals — look for ISO certifications, ONR licences, Environment Agency permits, or other nuclear and infrastructure sector accreditations.

Reputation and controversy — look for regulatory sanctions, legal disputes, whistleblower reports, press criticism, or ESG/modern-slavery concerns in public sources.

## Evaluation rubric (self-check before responding)

Before emitting your JSON, verify:
1. Every URL in sourceUrl and citations.url appears verbatim in the provided search results.
2. rawSnippet is an exact quote, not a paraphrase.
3. confidence is HIGH only if the finding came from structured UK API data.
4. The not-found sentinel is used if no real source supports the finding.
5. No field is null unless sourceDate is explicitly unknown.
6. summary is concise (1–3 sentences) and states the finding, not the search process.
7. citations includes all Tavily URLs used, even if they also appear as sourceUrl.
`.trim();

/**
 * Build a Tavily search query for a firm and topic.
 *
 * Quotes the firm name for exact-match relevance and appends topic.searchTerms
 * (editable per topic in the Topics UI). Falls back to topic.name if empty.
 */
export function buildSearchQuery(firmName: string, topic: Topic): string {
  const terms = topic.searchTerms?.trim() || topic.name;
  return `"${firmName}" ${terms}`;
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

  const descriptionLine = topic.description
    ? `\nDescription: ${topic.description}`
    : "";

  return `
## Topic: ${topic.name}${descriptionLine}

### Web Search Results (Tavily — cite by URL, confidence MEDIUM)
${searchBlock}

### Instruction
Synthesise a finding for topic "${topic.name}" about ${firmName}.
If no reliable source supports a finding on this topic, use the not-found sentinel described in the system prompt.
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
