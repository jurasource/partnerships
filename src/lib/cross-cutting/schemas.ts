/**
 * Zod schemas for AI-extracted cross-cutting records.
 *
 * These schemas validate all LLM output before it reaches the database (T-04-01),
 * enforcing citation completeness and preventing fabricated/unsourced data from
 * being persisted (T-04-03).
 *
 * NO "server-only" import — these files must be importable by the standalone
 * BullMQ worker process (Phase 2 decision, recorded in STATE.md).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Ownership extraction (topic: "Ownership structure" + CH PSC data)
// ---------------------------------------------------------------------------

export const OwnershipExtractionSchema = z.object({
  ukIncorporated: z
    .enum(["yes", "no", "unknown"])
    .describe(
      "Whether the firm is UK incorporated. " +
        "'yes' = Companies House jurisdiction is UK or PSC nationality is UK. " +
        "'no' = corporate PSC is foreign-registered with no UK entity in the chain. " +
        "'unknown' = insufficient data to determine.",
    ),
  ultimateParent: z
    .string()
    .nullable()
    .describe(
      "Name of the ultimate beneficial parent entity, or null if not determinable from the provided data. " +
        "Do not infer a parent if not explicitly stated in the finding text.",
    ),
  countryOfOwnership: z
    .string()
    .nullable()
    .describe(
      "ISO 3166-1 alpha-2 country code (e.g. 'US', 'FR') or 'UK' for UK-owned firms. " +
        "Null if not determinable. Derive from the PSC country_of_residence or jurisdiction field.",
    ),
  pscNotTraceable: z
    .enum(["yes", "no"])
    .describe(
      "'yes' if the PSC chain cannot be further traced through Companies House data " +
        "(e.g. a foreign corporate PSC with no UK registration number). " +
        "'no' otherwise.",
    ),
});

export type OwnershipExtraction = z.infer<typeof OwnershipExtractionSchema>;

// ---------------------------------------------------------------------------
// Risk flag extraction (topics: "Financial health", "Regulatory approvals",
//                               "Reputation and controversy")
// ---------------------------------------------------------------------------

export const RiskFlagExtractionSchema = z.object({
  flagType: z
    .enum(["financial", "reputational", "regulatory"])
    .describe(
      "Category of risk. This is forced by the calling code — do not choose the category yourself; " +
        "accept the value specified in the extraction prompt.",
    ),
  severity: z
    .enum(["High", "Medium", "Low"])
    .describe(
      "'High' = material threat to firm viability or consortium suitability (e.g. insolvency risk, HSE prohibition notice). " +
        "'Medium' = notable concern requiring monitoring (e.g. profit warning, minor regulatory breach). " +
        "'Low' = minor issue with limited impact.",
    ),
  description: z
    .string()
    .min(10)
    .describe(
      "Concise description of the risk, grounded in the provided finding text. " +
        "1-2 sentences. Do not fabricate; only describe risks explicitly stated.",
    ),
  sourceUrl: z
    .string()
    .min(1)
    .describe(
      "URL of the primary source that evidences this risk. " +
        "Copy from the finding's sourceUrl field. Must be a real URL present in the finding.",
    ),
  sourceTitle: z
    .string()
    .min(1)
    .describe("Human-readable title of the source document."),
  sourceDate: z
    .string()
    .nullable()
    .describe(
      "Publication date of the evidence source in ISO format (e.g. '2024-03-15'). " +
        "Copy from the finding's sourceDate if present; otherwise null.",
    ),
  rawSnippet: z
    .string()
    .min(1)
    .describe(
      "Verbatim excerpt from the source that directly evidences this risk. " +
        "Do not paraphrase; copy the relevant text.",
    ),
});

export type RiskFlagExtraction = z.infer<typeof RiskFlagExtractionSchema>;

/**
 * Wrapper schema for LLM extraction of risk flags from a single finding.
 * The model returns an array of flags — potentially empty if no risks are stated.
 */
export const RiskFlagsExtractionSchema = z.object({
  flags: z
    .array(RiskFlagExtractionSchema)
    .describe(
      "Array of risk flags extracted from the provided finding text. " +
        "Output an empty array if no risk is explicitly stated with a cited source. " +
        "Do not infer risks; only extract what is present in the finding.",
    ),
});

export type RiskFlagsExtraction = z.infer<typeof RiskFlagsExtractionSchema>;
