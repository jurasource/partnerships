import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// --- firms ---------------------------------------------------------------
export const firms = sqliteTable("firms", {
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
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// --- topics --------------------------------------------------------------
export const topics = sqliteTable("topics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// --- procurementRecords --------------------------------------------------
export const procurementRecords = sqliteTable(
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("procurement_records_ocid_unique").on(table.ocid)],
);

// --- jobs ----------------------------------------------------------------
export const jobs = sqliteTable("jobs", {
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
  status: text("status", {
    enum: ["pending", "running", "done", "failed"],
  })
    .notNull()
    .default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
});

// --- findings ------------------------------------------------------------
export const findings = sqliteTable("findings", {
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
   * Confidence level (D-11):
   *   HIGH   = from structured UK API (CH / CF / FTS)
   *   MEDIUM = AI-derived with a cited source
   *   LOW    = AI-derived without a verifiable source (triggers "not found" output)
   */
  confidence: text("confidence", {
    enum: ["HIGH", "MEDIUM", "LOW"],
  }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
