/**
 * Zod schemas for AI-synthesised research findings.
 *
 * FindingSchema enforces the citation invariant (D-11) at the type-system level:
 * every field the UI or DB requires is z.string().min(1), not optional.
 * The schema is the contract; the prompt is the instruction.
 *
 * Key design decisions:
 * - confidence enum is EXACTLY ['HIGH','MEDIUM'] — LOW is non-storable (D-09).
 *   LOW is never a valid output state; coerce to NOT_FOUND_SENTINEL instead.
 * - NOT_FOUND_SENTINEL returns a confidence:HIGH sentinel because "we looked
 *   and found nothing" is itself a definitive structured fact (RES-05, D-11).
 */

import { z } from "zod";

export const CitationSchema = z.object({
  url: z.string().min(1),
  title: z.string().min(1),
  snippet: z.string().min(1),
  date: z.string().nullable().optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

export const FindingSchema = z.object({
  summary: z
    .string()
    .min(10)
    .describe("1-3 sentence synthesis of the finding, grounded in the provided sources"),
  confidence: z
    .enum(["HIGH", "MEDIUM"])
    .describe(
      "HIGH = fact drawn directly from UK structured API data (Companies House / Contracts Finder / FTS). " +
        "MEDIUM = AI-derived finding with a cited Tavily source URL. " +
        "Never emit LOW — emit the not-found sentinel instead.",
    ),
  sourceUrl: z
    .string()
    .min(1)
    .describe('URL of the primary source. Use "not-found" only when emitting the absence sentinel.'),
  sourceTitle: z
    .string()
    .min(1)
    .describe("Human-readable title of the source document or web page"),
  rawSnippet: z
    .string()
    .min(1)
    .describe("Verbatim excerpt or data from the source that directly supports the summary"),
  sourceDate: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Publication date of the cited source in ISO format (e.g. '2024-03-15'). " +
        "Copy from the 'Published:' field shown in the search results for MEDIUM confidence findings. " +
        "Omit or set null if the source has no date, or for HIGH confidence structured data.",
    ),
  citations: z
    .array(CitationSchema)
    .optional()
    .default([])
    .describe(
      "All Tavily result URLs used to synthesise this MEDIUM-confidence finding. " +
        "May overlap with sourceUrl. Empty array for HIGH-confidence structured data or not-found sentinels.",
    ),
});

export type SynthesisedFinding = z.infer<typeof FindingSchema>;

/**
 * Explicit "not found" sentinel (D-11) — avoids silent missing rows.
 *
 * Used when:
 * - generateText throws NoObjectGeneratedError
 * - result.output is undefined (schema validation passed but output is null)
 * - Citation-origin gate: MEDIUM finding's sourceUrl not in retrieved results (E4)
 * - LOW confidence rejected at the FindingSchema level
 *
 * @param topicId   Topic ID for diagnostic context in rawSnippet
 * @param reason    Human-readable reason why no finding was produced
 */
export function NOT_FOUND_SENTINEL(topicId: string, reason: string): SynthesisedFinding {
  return {
    summary: `Not found: ${reason}`,
    confidence: "HIGH", // sentinel is a definitive structured fact: "we looked and found nothing"
    sourceUrl: "not-found",
    sourceTitle: "Research worker",
    rawSnippet: `No verifiable source found for topic "${topicId}". Reason: ${reason}`,
    citations: [],
  };
}

/**
 * Technical failure sentinel — distinct from NOT_FOUND_SENTINEL.
 *
 * Used when a technical error prevented research from completing (token truncation,
 * schema parse failure, etc.) rather than a genuine absence of information.
 * Stored with sourceUrl="research-error" so the UI can show a user-facing error
 * message rather than "Nothing found" (which would be misleading).
 */
export function RESEARCH_ERROR_SENTINEL(topicId: string, reason: string): SynthesisedFinding {
  return {
    summary: `Research error: ${reason}`,
    confidence: "HIGH",
    sourceUrl: "research-error",
    sourceTitle: "Research worker",
    rawSnippet: `Research failed for topic "${topicId}". Reason: ${reason}`,
    citations: [],
  };
}
