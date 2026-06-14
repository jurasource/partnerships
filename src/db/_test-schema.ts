// SQLite schema used ONLY in tests — mirrors the production pg schema column
// for column so route.test.ts can run against an in-memory SQLite instance
// without requiring pg-mem or a live Postgres server.
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const firms = sqliteTable("firms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  canonicalName: text("canonical_name").notNull(),
  aliases: text("aliases").notNull().default("[]"),
  companiesHouseNumber: text("companies_house_number"),
  capabilityTags: text("capability_tags").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  lastResearchedAt: text("last_researched_at"),
});

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const procurementRecords = sqliteTable(
  "procurement_records",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id").notNull(),
    ocid: text("ocid").notNull(),
    sourceApi: text("source_api").notNull(),
    title: text("title"),
    noticeDate: text("notice_date"),
    value: text("value"),
    supplierChNumber: text("supplier_ch_number"),
    awardDate: text("award_date"),
    contractingAuthority: text("contracting_authority"),
    rawJson: text("raw_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("procurement_records_ocid_unique").on(table.ocid)],
);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id").notNull(),
  topicId: text("topic_id"),
  status: text("status", { enum: ["pending", "running", "done", "failed"] })
    .notNull()
    .default("pending"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
});

export const findings = sqliteTable(
  "findings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id").notNull(),
    topicId: text("topic_id").notNull(),
    summary: text("summary").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    rawSnippet: text("raw_snippet").notNull(),
    sourceDate: text("source_date"),
    confidence: text("confidence", { enum: ["HIGH", "MEDIUM", "LOW"] }).notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("findings_firm_topic_unique").on(table.firmId, table.topicId)],
);
