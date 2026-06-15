import { pgTable, text, uniqueIndex, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";

// --- firms ---------------------------------------------------------------
export const firms = pgTable("firms", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  canonicalName: text("canonical_name").notNull(),
  /** JSON array of string aliases, e.g. '["SNC-Lavalin", "Atkins"]' */
  aliases: text("aliases").notNull().default("[]"),
  /**
   * 8-character Companies House company number.
   * NULL when not yet confirmed — never invent a number (Pitfall 2).
   */
  companiesHouseNumber: text("companies_house_number"),
  /**
   * JSON array of capability tag strings.
   * Data-driven (never hard-coded enum column) per Pitfall 10.
   * Values: "Nuclear" | "Infrastructure" | "Consultancy"
   */
  capabilityTags: text("capability_tags").notNull().default("[]"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  /**
   * ISO timestamp set when a research job for this firm transitions to 'done'.
   * NULL = never researched. Used by Wave 2/3 for staleness detection (D-07).
   */
  lastResearchedAt: text("last_researched_at"),
});

// --- topics --------------------------------------------------------------
export const topics = pgTable("topics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

// --- procurementRecords --------------------------------------------------
export const procurementRecords = pgTable(
  "procurement_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    /**
     * OCDS notice ID — primary dedup key (D-09).
     * UNIQUE constraint ensures the same notice from CF and FTS is stored once.
     */
    ocid: text("ocid").notNull(),
    /**
     * Which API returned this notice: "contracts_finder" | "find_a_tender" (D-09).
     */
    sourceApi: text("source_api").notNull(),
    title: text("title"),
    noticeDate: text("notice_date"),
    value: text("value"),
    supplierChNumber: text("supplier_ch_number"),
    awardDate: text("award_date"),
    contractingAuthority: text("contracting_authority"),
    /**
     * Full raw OCDS JSON payload (D-10).
     * Stored as TEXT so schema changes don't require re-fetching raw data.
     */
    rawJson: text("raw_json").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("procurement_records_ocid_unique").on(table.ocid)],
);

// --- jobs ----------------------------------------------------------------
export const jobs = pgTable("jobs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  /**
   * NULL = "run all topics for this firm" (D-08).
   */
  topicId: text("topic_id").references(() => topics.id),
  /**
   * Job lifecycle status (D-08): pending | running | done | failed
   */
  status: text("status")
    .$type<"pending" | "running" | "done" | "failed">()
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
  /** Short human-readable progress update written by the worker as it runs. */
  progressMessage: text("progress_message"),
  /**
   * Discriminator for the job type (D-12).
   * "research"                = standard Phase 2 firm research job
   * "cross-cutting-analysis"  = Phase 4 derived-record extraction job
   */
  jobType: text("job_type")
    .$type<"research" | "cross-cutting-analysis" | "ch-refresh">()
    .notNull()
    .default("research"),
});

// --- ownershipRecords ----------------------------------------------------
export const ownershipRecords = pgTable(
  "ownership_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    /**
     * Whether the firm is UK incorporated: yes | no | unknown.
     * Derived from CH PSC jurisdiction/nationality data.
     */
    ukIncorporated: text("uk_incorporated")
      .$type<"yes" | "no" | "unknown">()
      .notNull(),
    /**
     * Name of the ultimate parent entity — null when not determinable.
     */
    ultimateParent: text("ultimate_parent"),
    /**
     * ISO 2-letter country code of beneficial ownership, "UK", or null.
     */
    countryOfOwnership: text("country_of_ownership"),
    /**
     * Whether the PSC chain cannot be traced further through CH data.
     */
    pscNotTraceable: text("psc_not_traceable")
      .$type<"yes" | "no">()
      .notNull()
      .default("no"),
    /**
     * Source of the ownership record: structured CH data or AI research.
     */
    sourceType: text("source_type")
      .$type<"companies_house" | "ai_research">()
      .notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    rawSnippet: text("raw_snippet").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ownership_records_firm_unique").on(table.firmId)],
);

// --- riskFlags -----------------------------------------------------------
export const riskFlags = pgTable("risk_flags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  /**
   * Category of risk flag.
   */
  flagType: text("flag_type")
    .$type<"financial" | "reputational" | "regulatory">()
    .notNull(),
  /**
   * Severity level of the risk flag.
   */
  severity: text("severity")
    .$type<"High" | "Medium" | "Low">()
    .notNull(),
  description: text("description").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  /**
   * ISO date of the evidence source — null when not available.
   */
  sourceDate: text("source_date"),
  rawSnippet: text("raw_snippet").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
// Note: risk_flags has no uniqueIndex — re-extraction uses delete-then-insert (Pitfall 1).

// --- collaborationRecords ------------------------------------------------
export const collaborationRecords = pgTable(
  "collaboration_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    /**
     * Cultural fit summary derived from topic-7 AI finding — null when not determinable.
     */
    cultureFitSummary: text("culture_fit_summary"),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    rawSnippet: text("raw_snippet").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("collaboration_records_firm_unique").on(table.firmId)],
);

// --- conflictPairs -------------------------------------------------------
export const conflictPairs = pgTable(
  "conflict_pairs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /**
     * Always firmAId < firmBId lexicographically (canonical ordering — Pitfall 2).
     */
    firmAId: text("firm_a_id")
      .notNull()
      .references(() => firms.id),
    firmBId: text("firm_b_id")
      .notNull()
      .references(() => firms.id),
    conflictType: text("conflict_type")
      .$type<"audit" | "competitor">()
      .notNull(),
    evidenceSummary: text("evidence_summary").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    rawSnippet: text("raw_snippet").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("conflict_pairs_unique").on(
      table.firmAId,
      table.firmBId,
      table.conflictType,
    ),
  ],
);

// --- partnershipPairs ----------------------------------------------------
export const partnershipPairs = pgTable(
  "partnership_pairs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    firmAId: text("firm_a_id")
      .notNull()
      .references(() => firms.id),
    firmBId: text("firm_b_id")
      .notNull()
      .references(() => firms.id),
    partnershipType: text("partnership_type")
      .$type<"co-supplier" | "jv">()
      .notNull(),
    evidenceSummary: text("evidence_summary").notNull(),
    /**
     * Source of partnership evidence: OCDS procurement data or AI research.
     */
    sourceType: text("source_type")
      .$type<"ocds" | "ai_research">()
      .notNull(),
    /**
     * OCDS notice ID for co-supplier type; URL for AI research type.
     */
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    /**
     * ISO date of the award or announcement — null when not available.
     */
    evidenceDate: text("evidence_date"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("partnership_pairs_unique").on(
      table.firmAId,
      table.firmBId,
      table.partnershipType,
      table.sourceUrl,
    ),
  ],
);

// --- findings ------------------------------------------------------------
export const findings = pgTable(
  "findings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id),
    summary: text("summary").notNull(),
    /**
     * Mandatory citation fields (D-11).
     * Every finding MUST carry a retrievable source URL.
     */
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    /**
     * Exact snippet retrieved from the source (D-11).
     * Stored alongside the URL so link rot doesn't erase the evidence.
     */
    rawSnippet: text("raw_snippet").notNull(),
    /**
     * Publication date of the cited source (ISO string, e.g. "2024-03-15").
     * NULL for structured API sources or when the provider does not supply a date.
     */
    sourceDate: text("source_date"),
    /**
     * JSON array of supporting Tavily citation objects for MEDIUM-confidence findings.
     * Each entry: { url, title, snippet, date? }. Empty array for HIGH/sentinel rows.
     */
    citations: text("citations").notNull().default("[]"),
    /**
     * Confidence level (D-11):
     *   HIGH   = from structured UK API (CH / CF / FTS)
     *   MEDIUM = AI-derived with a cited source
     *   LOW    = AI-derived without a verifiable source (triggers "not found" output)
     */
    confidence: text("confidence")
      .$type<"HIGH" | "MEDIUM" | "LOW">()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  /**
   * Unique constraint on (firm_id, topic_id) — ensures each re-run replaces the
   * prior finding via upsert rather than accumulating duplicate rows (CR-03).
   */
  (table) => [uniqueIndex("findings_firm_topic_unique").on(table.firmId, table.topicId)],
);

// --- groups --------------------------------------------------------------
export const groups = pgTable(
  "groups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("groups_name_unique").on(table.name)],
);

// --- firmGroups ----------------------------------------------------------
/**
 * Many-to-many junction between firms and groups.
 * Composite PK on (firm_id, group_id) — prevents duplicate memberships.
 * Both FKs cascade on delete so removing a firm OR group cleans up junction rows.
 */
export const firmGroups = pgTable(
  "firm_groups",
  {
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.firmId, table.groupId] })],
);

// --- jvLeads -------------------------------------------------------------
/**
 * Unresolved JV partner mentions extracted during collaboration analysis.
 * Written when the AI identifies a JV partner by name but that firm is not
 * yet tracked in the DB. Cleared and re-populated on each re-extraction so
 * the list stays fresh — once the mentioned firm is added and research is
 * re-run, the entry resolves into a partnership_pair and disappears here.
 */
export const jvLeads = pgTable(
  "jv_leads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** The firm whose research mentioned this JV partner. */
    sourceFirmId: text("source_firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),
    /** Firm name exactly as extracted by the AI — not normalised. */
    mentionedFirmName: text("mentioned_firm_name").notNull(),
    evidenceSummary: text("evidence_summary").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    evidenceDate: text("evidence_date"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jv_leads_source_firm_name_unique").on(
      table.sourceFirmId,
      table.mentionedFirmName,
    ),
  ],
);

// --- chSnapshots ---------------------------------------------------------
/**
 * Cached raw Companies House API responses for each firm.
 * Written (upserted) during cross-cutting analysis whenever CH data is fetched.
 * Read on the firm profile page so the UI never calls the CH API directly.
 * JSON columns are nullable — a field is null when the CH fetch failed or the
 * firm has no CH number.
 */
export const chSnapshots = pgTable(
  "ch_snapshots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    profileJson: text("profile_json"),
    pscJson: text("psc_json"),
    officersJson: text("officers_json"),
    fetchedAt: timestamp("fetched_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ch_snapshots_firm_unique").on(table.firmId)],
);

// --- accessCodes ---------------------------------------------------------
export const accessCodes = pgTable("access_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  codeHash: text("code_hash").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  active: boolean("active").default(true).notNull(),
});
