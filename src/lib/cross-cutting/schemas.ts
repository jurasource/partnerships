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

// ---------------------------------------------------------------------------
// Conflict pair extraction (topics: "Partnerships and JVs", "Reputation and
//                                    controversy")
// ---------------------------------------------------------------------------

export const ConflictPairExtractionSchema = z.object({
  otherFirmName: z
    .string()
    .min(1)
    .describe(
      "Exact name of the other firm as mentioned in the finding text. " +
        "Use the name as written — do not normalise or abbreviate. " +
        "This name will be resolved against the known firms database; " +
        "if it cannot be resolved, it will be discarded.",
    ),
  conflictType: z
    .enum(["audit", "competitor"])
    .describe(
      "'audit' = one firm audits or has audited the other (conflict of interest for joint delivery). " +
        "'competitor' = the two firms directly compete for the same contracts or market segments. " +
        "Output only one of these two values.",
    ),
  evidenceSummary: z
    .string()
    .min(10)
    .describe(
      "Concise (1-2 sentence) summary of the conflict evidence. " +
        "Ground this in the provided finding text only — do not infer.",
    ),
  sourceUrl: z
    .string()
    .min(1)
    .describe(
      "URL of the source that evidences this conflict relationship. " +
        "Copy from the finding's sourceUrl field. Must be present in the finding.",
    ),
  sourceTitle: z
    .string()
    .min(1)
    .describe("Human-readable title of the source document."),
  rawSnippet: z
    .string()
    .min(1)
    .describe(
      "Verbatim excerpt from the source that evidences this conflict. " +
        "Do not paraphrase; copy the relevant text.",
    ),
});

export type ConflictPairExtraction = z.infer<typeof ConflictPairExtractionSchema>;

/**
 * Wrapper schema for LLM extraction of conflict pairs from a single finding.
 * Extract ONLY named pairs with explicit evidence in the finding text.
 * Output an empty array if no explicit conflict evidence exists.
 */
export const ConflictsExtractionSchema = z.object({
  conflicts: z
    .array(ConflictPairExtractionSchema)
    .describe(
      "Array of conflict pairs extracted from the provided finding text. " +
        "Each entry must name another firm and the type of conflict with cited evidence. " +
        "Output an empty array if no explicit conflict evidence is present in the text. " +
        "Do NOT infer, extrapolate, or fabricate conflicts — only extract what is explicitly stated.",
    ),
});

export type ConflictsExtraction = z.infer<typeof ConflictsExtractionSchema>;

// ---------------------------------------------------------------------------
// JV partnership extraction (topic: "Partnerships and JVs")
// ---------------------------------------------------------------------------

export const JVPartnershipItemSchema = z.object({
  otherFirmName: z
    .string()
    .min(1)
    .describe(
      "Name of the other firm in the JV or announced partnership, as written in the finding text. " +
        "Use the name exactly as it appears — it will be resolved against the known firms database.",
    ),
  evidenceSummary: z
    .string()
    .min(10)
    .describe(
      "Concise (1-2 sentence) summary of the joint venture or partnership evidence. " +
        "Only include explicitly announced or documented JVs; do not infer from co-bid history.",
    ),
  sourceUrl: z
    .string()
    .min(1)
    .describe("URL of the source that evidences this JV or partnership."),
  sourceTitle: z
    .string()
    .min(1)
    .describe("Human-readable title of the source document."),
  evidenceDate: z
    .string()
    .nullable()
    .describe(
      "Date the JV/partnership was announced or documented (ISO format e.g. '2024-03-15'). " +
        "Null if the date is not stated in the finding.",
    ),
  rawSnippet: z
    .string()
    .min(1)
    .describe(
      "Verbatim excerpt from the source that evidences this JV or partnership. " +
        "Do not paraphrase.",
    ),
});

export type JVPartnershipItem = z.infer<typeof JVPartnershipItemSchema>;

/**
 * Wrapper schema for LLM extraction of explicitly announced JVs from a finding.
 * Output an empty array if no announced JVs are explicitly stated.
 */
export const JVPartnershipsExtractionSchema = z.object({
  partnerships: z
    .array(JVPartnershipItemSchema)
    .describe(
      "Array of explicitly announced joint ventures or formal partnerships extracted from the finding text. " +
        "Only include items where a JV or formal partnership is explicitly named or announced. " +
        "Do not include informal collaborations, co-bidding, or subcontracting relationships. " +
        "Output an empty array if no explicit JV/partnership evidence is present.",
    ),
});

export type JVPartnershipsExtraction = z.infer<typeof JVPartnershipsExtractionSchema>;

// ---------------------------------------------------------------------------
// Collaboration extraction (topic: "Partnerships and JVs")
// ---------------------------------------------------------------------------

/**
 * Schema for extracting the culture-fit summary from the "Partnerships and JVs" finding.
 * This produces a single collaboration_records row per firm.
 */
export const CollaborationExtractionSchema = z.object({
  cultureFitSummary: z
    .string()
    .nullable()
    .describe(
      "Summary of the firm's collaborative culture, joint delivery track record, and partnering style " +
        "as evidenced in the finding text. " +
        "2-4 sentences describing how the firm works with others, their approach to partnerships, " +
        "and any notable joint delivery history mentioned. " +
        "Null only if the finding text contains no relevant information about collaboration or culture.",
    ),
  sourceUrl: z
    .string()
    .min(1)
    .describe(
      "URL of the primary source that provides collaboration/culture-fit evidence. " +
        "Copy from the finding's sourceUrl field.",
    ),
  sourceTitle: z
    .string()
    .min(1)
    .describe("Human-readable title of the source document."),
  rawSnippet: z
    .string()
    .min(1)
    .describe(
      "Verbatim excerpt from the source that evidences the collaboration/culture-fit. " +
        "Do not paraphrase.",
    ),
});

export type CollaborationExtraction = z.infer<typeof CollaborationExtractionSchema>;
