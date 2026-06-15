# Phase 4: Cross-Cutting Analysis - Research

**Researched:** 2026-06-15
**Domain:** Derived-record extraction, BullMQ job chaining, Drizzle schema extension, cross-firm relationship UI (Next.js 16 App Router + shadcn/ui)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Cross-cutting structured records populated by re-processing existing Phase 2 findings — a second LLM pass reads cached topic-3/4/6/7 findings and extracts structured JSON. No new Tavily calls.
- **D-02:** Firms with no Phase 2 findings leave cross-cutting records empty. Profile shows "Run research first to enable cross-cutting analysis." No automatic research trigger.
- **D-03:** Conflict detection scope: audit relationships AND direct competitor relationships, AI-extracted from topic-4 finding for each firm. Named pairs with existing evidence in the finding citation.
- **D-04:** Conflict pairs and partnership pairs surface on a new `/analysis` page with: (1) conflict matrix (firm × firm grid); (2) partnership evidence table; (3) ownership nationality roll-up.
- **D-05:** Firm profiles also surface that firm's relationships from its own perspective (Conflicts of Interest section, Known Partnerships section).
- **D-06:** Sidebar/nav gains a link to `/analysis` alongside the existing Dashboard entry.
- **D-07:** Ownership tracing uses CH PSC first-level data (immediate PSC jurisdiction, nationality, % control) corroborated by topic-6 AI finding. Foreign corporate PSC with no UK registration flagged: "ultimate parent not publicly traceable via CH."
- **D-08:** No recursive CH lookup for parent companies in Phase 4. Parent chain depth is first-level PSC + AI finding text.
- **D-09:** Comparison table gets a new "Ownership" column: colour-coded badge "UK" (green) or parent country ISO code (amber). Sortable. Sources link to CH PSC entry or topic-6 finding.
- **D-10:** When a research job completes (BullMQ worker transitions job to `done`), enqueue a separate BullMQ job of type `cross-cutting-analysis` for that firm. Decouples research from extraction.
- **D-11:** The cross-cutting job recomputes: the firm's own ownership record, risk flags, and collaboration history; AND all conflict/partnership pairs where that firm is either participant.
- **D-12:** The `/jobs` page shows both job types (`research` and `cross-cutting-analysis`) with appropriate labels.
- **Folded todo:** CH company number rendered as clickable external link to `https://find-and-update.company-information.service.gov.uk/company/{number}` in the ownership section.

### Claude's Discretion

None stated explicitly — implementation details (LLM prompt design, SQL query shape for co-supplier detection, Zod schema structures for new tables) are at implementer discretion provided they follow established patterns.

### Deferred Ideas (OUT OF SCOPE)

- "Name this tool 'Partnerships'" — backlog item, not Phase 4.
- "View firm refresh results after data pull" / "Show CH summary panel in firm edit dialog" — v2.
- "Discover unlisted firms" — separate phase/backlog.
- "Consortium analysis firm selection and named groups" — Phase 5.
- Recursive CH parent chain lookup — v2 enhancement.
- SSE/streaming for cross-cutting job progress — polling is sufficient (Phase 2 precedent).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-04 | Profile shows ownership structure: UK-incorporated status, ultimate parent company, country of ownership, and source | New `ownership_records` table; extraction from `grounding.ts` PSC logic + topic-6 finding; OwnershipSection component |
| PROF-05 | Profile shows risk flags (financial, reputational, regulatory) with severity level and dated sources | New `risk_flags` table; LLM extraction from topic-3 finding; RiskFlagsSection component; severity sort |
| PROF-07 | Profile shows collaboration history and cultural fit indicators: prior joint delivery evidence and org culture signals | New `collaboration_records` table; LLM extraction from topic-7 finding + OCDS co-supplier SQL query |
| ANAL-01 | System detects and flags conflicts of interest between pairs of firms (audit + competitor) with sourced evidence | New `conflict_pairs` table; LLM extraction from topic-4 finding; conflict matrix UI on /analysis |
| ANAL-02 | System identifies which firms work or have worked together (co-supplier awards and announced JVs) | New `partnership_pairs` table; SQL co-supplier query on `procurement_records` + topic-7 LLM extraction |
| ANAL-03 | Ownership nationality surfaced prominently on firm profiles and in comparison table | Ownership column extension in ComparisonTable; OwnershipSection in firm profile; /analysis ownership roll-up |
| ANAL-04 | Cross-cutting analysis results recomputed when any firm is refreshed | `cross-cutting-analysis` BullMQ job type enqueued from `runner.ts` after research job transitions to `done` |
</phase_requirements>

---

## Summary

Phase 4 is an extraction and surfacing phase, not a net-new research phase. All data comes from: (a) already-cached `findings` rows (topics 3, 4, 6, 7), (b) already-fetched `procurement_records` rows (co-supplier signal via shared `ocid`), and (c) already-implemented Companies House PSC data (via `grounding.ts`/`companies-house.ts`). Phase 4's job is to run a second LLM pass over these cached findings to extract structured JSON records — ownership, risk flags, collaboration signals, conflict pairs, partnership pairs — and persist them into new tables, then surface them in the UI.

The BullMQ worker already exists (`src/scripts/worker-process.ts`) and handles research jobs. Phase 4 extends this worker to handle a second job type: `cross-cutting-analysis`. After a research job completes in `runner.ts`, it enqueues a `cross-cutting-analysis` BullMQ job for that firm. The cross-cutting worker reads cached findings from the `findings` table, runs LLM extraction, and writes structured records via Drizzle upsert.

The UI adds: (1) five new sections on each firm profile page, (2) an Ownership column on the comparison table, (3) a new `/analysis` page with three sections, and (4) a sidebar nav entry for `/analysis`. The `analysis/conflict-matrix` uses CSS Grid (not TanStack Table) because it is a symmetric firm × firm matrix. The `analysis/partnership-table` uses TanStack Table (already present). All design tokens, component patterns, and copy are specified in `04-UI-SPEC.md`.

**Primary recommendation:** Implement in three sequential waves: (1) database schema additions + migration, (2) BullMQ job chaining + LLM extraction worker, (3) UI surface (profile sections + comparison table column + `/analysis` page + sidebar nav).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ownership extraction (CH PSC → structured record) | API / Backend (worker process) | — | Worker already reads CH data; extraction is CPU/DB work, not UI |
| Risk flag extraction (topic-3 finding → risk_flags rows) | API / Backend (worker process) | — | LLM extraction happens in worker, not client |
| Conflict pair detection (topic-4 finding → conflict_pairs rows) | API / Backend (worker process) | — | LLM extraction; pairs involve multiple firms, best computed server-side |
| Co-supplier partnership detection (OCDS shared ocid → SQL query) | API / Backend (worker process) | Database / Storage | SQL query runs in worker; `procurementRecords` table is the source |
| Cross-cutting job enqueue trigger | API / Backend (runner.ts) | — | Called from `executeResearchJob` after research job transitions to `done` |
| `/analysis` page data fetching | Frontend Server (RSC) | Database / Storage | RSC direct DB read pattern established in Phase 3 |
| Conflict matrix rendering | Browser / Client | — | Symmetric grid with interactive firm-name links; client component |
| Firm profile additions (Ownership, Risk Flags, etc.) | Frontend Server (RSC) | — | Profile data fetched server-side like existing `getFirmProfile` |
| Comparison table Ownership column | Browser / Client | — | Column added to existing `"use client"` ComparisonTable component |
| Sidebar `/analysis` nav entry | Browser / Client | — | `app-sidebar.tsx` is already `"use client"` |

---

## Standard Stack

### Core (established — no new packages required for Phase 4)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.45.2 [VERIFIED: package.json] | Schema extension + typed queries for new tables | Existing ORM; `onConflictDoUpdate` for upsert pattern (D-10/D-11) |
| BullMQ | 5.78.1 [VERIFIED: package.json] | New `cross-cutting-analysis` queue + job type | Existing queue transport; same pattern as `research` queue |
| Vercel AI SDK | 6.0.205 (`ai`) [VERIFIED: package.json] | LLM extraction pass (`generateObject`/`generateText` with `Output.object`) | Established for structured output; `FindingSchema` pattern reused |
| @ai-sdk/anthropic | 3.0.84 [VERIFIED: package.json] | LLM provider for extraction | Existing provider; `claude-sonnet-4-6` already used in worker.ts |
| Zod | 4.4.3 [VERIFIED: package.json] | Schemas for extracted records (ownership, risk flags, conflict pairs, etc.) | Existing; pairs with AI SDK structured output |
| TanStack Table | 8.21.3 [VERIFIED: package.json] | Partnership evidence table on `/analysis` | Existing; same pattern as ComparisonTable |
| shadcn/ui | (CLI-installed components) | New component sections (all primitives already installed) | Established; no new shadcn components need to be installed |
| lucide-react | 1.18.0 [VERIFIED: package.json] | `Network` icon for sidebar, `ExternalLink` icon for CH link | Existing; all icons already in dependency |
| Next.js | 16.2.9 [VERIFIED: package.json] | New RSC `/analysis` route, profile page extension | Full-stack framework already in use |
| postgres | 3.4.5 [VERIFIED: package.json] | Drizzle postgres dialect | Existing DB client |

**No new npm packages are required for Phase 4.** All capabilities are covered by the existing dependency tree.

### Installation

```bash
# No new packages — Phase 4 uses the existing dependency tree entirely
```

---

## Package Legitimacy Audit

> Phase 4 installs no new external packages. All capabilities are provided by the existing dependency tree verified in Phases 1–3.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | No new packages |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Research job completes (runner.ts)
        │
        ▼
enqueueJob('cross-cutting-analysis', { firmId })  ←── bull.ts (new queue or same queue, new type)
        │
        ▼
BullMQ worker (worker-process.ts)
  switch jobType === 'cross-cutting-analysis':
        │
        ├── Read findings by topic name lookup
        │   findings WHERE firmId = X AND topicId IN [topic3, topic4, topic6, topic7]
        │
        ├── LLM extraction pass (generateObject)
        │   topic6 finding → OwnershipRecord (+ CH PSC data from grounding.ts)
        │   topic3 finding → RiskFlag[] (severity + dated source)
        │   topic7 finding → CollaborationRecord (joint delivery evidence)
        │   topic4 finding → ConflictPair[] (pairs involving this firm)
        │   topic7 finding → PartnershipPair[] announced JVs
        │
        ├── SQL co-supplier query
        │   SELECT ocid, firmIds WHERE supplierChNumber IN (firm.chNumber, counterpart.chNumber)
        │   → PartnershipPair[] (type: 'co-supplier')
        │
        ├── Drizzle upsert (onConflictDoUpdate)
        │   ownership_records, risk_flags, collaboration_records, conflict_pairs, partnership_pairs
        │
        └── Update jobs table: done / failed
                │
                ▼
Next.js RSC data queries
  getFirmProfileWithCrossCutting(firmId) → FirmProfile + ownership + riskFlags + collaboration + conflicts + partnerships
  getAnalysisPageData() → conflictMatrix, partnershipPairs, ownershipRollup
        │
        ▼
UI Layer
  /firms/[id]  → OwnershipSection, RiskFlagsSection, CollaborationSection, FirmConflictsList, FirmPartnershipsList
  /            → ComparisonTable (+ Ownership column)
  /analysis    → OwnershipRollup, ConflictMatrix (CSS Grid), PartnershipTable (TanStack)
  sidebar      → /analysis nav entry (Network icon)
```

### Recommended Project Structure (Phase 4 additions)

```
src/
├── db/
│   └── schema.ts                        # +5 new tables
├── lib/
│   ├── jobs/
│   │   ├── bull.ts                      # extend with cross-cutting queue config
│   │   └── runner.ts                    # enqueue cross-cutting job after research done
│   └── cross-cutting/                   # NEW: extraction logic (parallel to research/)
│       ├── schemas.ts                   # Zod schemas for 5 new record types
│       ├── extractor.ts                 # LLM extraction pass (generateObject per record type)
│       ├── co-supplier.ts               # SQL co-supplier detection query
│       └── runner.ts                    # executeCrossCuttingJob orchestrator
├── queries/
│   ├── firm-profile.ts                  # extend getFirmProfile to include cross-cutting data
│   ├── analysis-page.ts                 # NEW: getAnalysisPageData()
│   └── comparison-rows.ts              # extend with ownership join
├── scripts/
│   └── worker-process.ts               # extend switch to handle cross-cutting-analysis
└── components/
    ├── analysis/                        # NEW: /analysis page components
    │   ├── conflict-matrix.tsx
    │   ├── partnership-table.tsx
    │   └── ownership-rollup.tsx
    └── firms/
        ├── ownership-section.tsx        # NEW
        ├── risk-flags-section.tsx       # NEW
        ├── collaboration-section.tsx    # NEW
        ├── firm-conflicts-list.tsx      # NEW
        └── firm-partnerships-list.tsx   # NEW
src/app/
└── (app)/
    └── analysis/
        └── page.tsx                     # NEW RSC route
```

### Pattern 1: New Drizzle Tables for Cross-Cutting Records

**What:** Five new tables added to `schema.ts` to hold derived cross-cutting records. These are NOT reusing the `findings` table because the `findings` table has a `UNIQUE (firmId, topicId)` constraint that cannot represent pairwise records.

**Schema design notes:**
- `ownership_records`: one row per firm. Upsert on firmId.
- `risk_flags`: one-to-many per firm (multiple flags). Upsert strategy: delete-then-insert on re-extraction (since a firm may gain/lose flags), or use a composite unique on `(firmId, flagType, sourceUrl)`.
- `collaboration_records`: one row per firm (summary of collaboration evidence). Upsert on firmId.
- `conflict_pairs`: one row per ordered pair `(firmAId, firmBId)` where firmAId < firmBId lexicographically to avoid duplicate pairs. Unique on `(firmAId, firmBId, conflictType)`.
- `partnership_pairs`: one row per ordered pair + evidence source. Unique on `(firmAId, firmBId, partnershipType, ocid_or_sourceUrl)`.

**When to use:** All cross-cutting records. Never put pairwise data in `findings`.

```typescript
// Source: existing schema.ts pattern — extended for Phase 4
// ownership_records — one per firm, upsert on firmId
export const ownershipRecords = pgTable("ownership_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id").notNull().references(() => firms.id),
  ukIncorporated: text("uk_incorporated").$type<"yes" | "no" | "unknown">().notNull(),
  ultimateParent: text("ultimate_parent"),       // null = not determinable
  countryOfOwnership: text("country_of_ownership"), // ISO 2-letter or "UK" or null
  pscNotTraceable: text("psc_not_traceable").$type<"yes" | "no">().notNull().default("no"),
  sourceType: text("source_type").$type<"companies_house" | "ai_research">().notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  rawSnippet: text("raw_snippet").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("ownership_records_firm_unique").on(table.firmId)]);

// risk_flags — many per firm; composite unique to support upsert
export const riskFlags = pgTable("risk_flags", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id").notNull().references(() => firms.id),
  flagType: text("flag_type").$type<"financial" | "reputational" | "regulatory">().notNull(),
  severity: text("severity").$type<"High" | "Medium" | "Low">().notNull(),
  description: text("description").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  sourceDate: text("source_date"),    // ISO date of evidence
  rawSnippet: text("raw_snippet").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
// Note: risk_flags has no composite unique — re-extraction deletes all for firmId then re-inserts

// conflict_pairs — pairwise, firm_a_id < firm_b_id lexicographically
export const conflictPairs = pgTable("conflict_pairs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmAId: text("firm_a_id").notNull().references(() => firms.id),
  firmBId: text("firm_b_id").notNull().references(() => firms.id),
  conflictType: text("conflict_type").$type<"audit" | "competitor">().notNull(),
  evidenceSummary: text("evidence_summary").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  rawSnippet: text("raw_snippet").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("conflict_pairs_unique").on(table.firmAId, table.firmBId, table.conflictType)]);

// partnership_pairs — co-supplier (from OCDS ocid) and JV (from AI finding)
export const partnershipPairs = pgTable("partnership_pairs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmAId: text("firm_a_id").notNull().references(() => firms.id),
  firmBId: text("firm_b_id").notNull().references(() => firms.id),
  partnershipType: text("partnership_type").$type<"co-supplier" | "jv">().notNull(),
  evidenceSummary: text("evidence_summary").notNull(),
  sourceType: text("source_type").$type<"ocds" | "ai_research">().notNull(),
  sourceUrl: text("source_url").notNull(),       // ocid for OCDS, URL for AI
  sourceTitle: text("source_title").notNull(),
  evidenceDate: text("evidence_date"),            // ISO date of award/announcement
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("partnership_pairs_unique").on(table.firmAId, table.firmBId, table.partnershipType, table.sourceUrl)]);

// collaboration_records — one per firm (cultural fit + prior delivery summary)
export const collaborationRecords = pgTable("collaboration_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id").notNull().references(() => firms.id),
  cultureFitSummary: text("culture_fit_summary"),   // from topic-7 AI finding
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  rawSnippet: text("raw_snippet").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("collaboration_records_firm_unique").on(table.firmId)]);
```
[ASSUMED — exact column names/types; adapt to project conventions]

### Pattern 2: BullMQ Job Type Extension

**What:** Extend the existing BullMQ worker to handle two job types on a single queue, using a `jobType` discriminator in the payload.

**When to use:** When a research job completes in `runner.ts`, enqueue a `cross-cutting-analysis` job.

```typescript
// Source: src/lib/jobs/bull.ts — extend with cross-cutting type
export type CrossCuttingJobPayload = {
  firmId: string;
  jobId: string;     // DB job row id for status tracking
};

export const CROSS_CUTTING_QUEUE_NAME = "cross-cutting-analysis";

export const crossCuttingQueue = new Queue<CrossCuttingJobPayload>(
  CROSS_CUTTING_QUEUE_NAME,
  { connection, defaultJobOptions: { attempts: 1, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } } }
);
```

```typescript
// Source: src/scripts/worker-process.ts — extend with second worker
import { executeCrossCuttingJob } from "@/lib/cross-cutting/runner";
import { CROSS_CUTTING_QUEUE_NAME, type CrossCuttingJobPayload } from "@/lib/jobs/bull";

const crossCuttingWorker = new Worker<CrossCuttingJobPayload>(
  CROSS_CUTTING_QUEUE_NAME,
  async (job) => {
    const { firmId, jobId } = job.data;
    await executeCrossCuttingJob(firmId, jobId);
  },
  { connection: { host: REDIS_HOST, port: REDIS_PORT }, concurrency: CONCURRENCY }
);
```
[ASSUMED — exact implementation; adapt to project worker pattern]

```typescript
// Source: src/lib/jobs/runner.ts — enqueue trigger after research done
// After: await updateJobStatus(jobId, "done", { completedAt: nowIso() });
const ccJobId = await enqueueJob({ firmId, topicId: null });
await crossCuttingQueue.add("cross-cutting", { firmId, jobId: ccJobId });
```
[ASSUMED — exact code; the important point is the trigger location]

### Pattern 3: LLM Extraction via generateObject (Vercel AI SDK)

**What:** Use `generateText` with `Output.object({ schema })` (same pattern as `worker.ts`) to extract structured records from cached finding summaries.

**When to use:** For each of the 5 record types that require LLM parsing: ownership (topic-6), risk flags (topic-3), collaboration (topic-7), conflict pairs (topic-4), JV partnerships (topic-7).

```typescript
// Source: src/lib/research/worker.ts — exact same pattern
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await generateText({
  model: anthropic("claude-sonnet-4-6"),
  system: EXTRACTION_SYSTEM_PROMPT,
  prompt: buildExtractionPrompt(cachedFinding.summary, cachedFinding.rawSnippet),
  output: Output.object({ schema: OwnershipExtractionSchema }),
  maxOutputTokens: 512,
  temperature: 0.1,
  maxRetries: 2,
});
```
[ASSUMED — adapt schema and prompt per record type; pattern confirmed from worker.ts]

### Pattern 4: Co-Supplier Detection via SQL

**What:** SQL query — not LLM — finds procurement notices where two different firms both appear as suppliers (shared `ocid`). This is a pure data join.

**When to use:** During the cross-cutting extraction pass for partnership detection (ANAL-02).

```typescript
// Source: existing procurementRecords schema — ocid column + supplierChNumber
// Find all ocids where the target firm and any other firm both appear
const coSupplierOcids = await db
  .select({
    ocid: procurementRecords.ocid,
    supplierChNumber: procurementRecords.supplierChNumber,
    firmId: procurementRecords.firmId,
    title: procurementRecords.title,
    awardDate: procurementRecords.awardDate,
  })
  .from(procurementRecords)
  .where(
    inArray(
      procurementRecords.ocid,
      db.select({ ocid: procurementRecords.ocid })
        .from(procurementRecords)
        .where(eq(procurementRecords.firmId, targetFirmId))
    )
  );
// Then group by ocid, filter for rows where firmId != targetFirmId → co-supplier pairs
```
[ASSUMED — exact Drizzle query; adapt for subquery syntax; may be simpler as a raw SQL or two-step query]

### Pattern 5: Ownership Extraction from CH PSC (reuse grounding.ts)

**What:** `grounding.ts` already fetches and parses CH PSC data into a structured string. Phase 4 adapts this to extract a structured `ownershipRecords` row rather than a formatted string.

**When to use:** During the ownership extraction step. Call `getCompanyProfile` and `getPSC` from `companies-house.ts` (already implemented), then interpret the PSC data directly (no LLM needed for the CH portion — CH data is structured). LLM is only needed to corroborate with topic-6 finding.

**Source:** `src/lib/research/grounding.ts` — the PSC nationality classification logic (UK_NATURAL_PERSON_TERMS, UK_COUNTRY_TERMS, corporate vs natural person detection) is directly reusable to determine `countryOfOwnership` and `ukIncorporated`.

### Anti-Patterns to Avoid

- **Storing pairwise conflict/partnership records in the `findings` table:** The `findings` table has a UNIQUE constraint on `(firmId, topicId)` — it cannot represent firm-pair records. New tables are mandatory (noted in CONTEXT.md).
- **Calling Tavily during the cross-cutting pass:** D-01 is explicit — no new Tavily calls. The extraction worker reads only from the `findings` table cache.
- **Accumulating risk flags across re-runs:** `riskFlags` has no composite unique suitable for upsert. The correct pattern is: delete all `riskFlags` rows for this `firmId`, then insert fresh rows. This avoids stale flags persisting after a research update.
- **Symmetric conflict_pairs storage (storing both A→B and B→A):** Store only the canonical pair where `firmAId < firmBId` (lexicographic). Queries must check BOTH orderings: `(firmAId = X OR firmBId = X)`. Storing both rows doubles the data and makes dedup harder.
- **CSS Grid vs TanStack Table for conflict matrix:** The conflict matrix is a symmetric firm × firm grid — use CSS Grid, not TanStack Table. TanStack is for the partnership evidence table only.
- **`"server-only"` in lib/ files:** Per Phase 2 decision (in STATE.md), `src/lib/` files must NOT include `"server-only"` so they are importable by the standalone worker process. This applies to all new `src/lib/cross-cutting/` files.
- **Asserting absence of conflicts as a conclusion:** ANAL-01 requires sourced evidence. The extraction prompt must instruct the LLM to output only named pairs with evidence present in the finding text. If no evidence exists, output an empty array.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured LLM output with schema validation | Custom JSON parser + regex | `Output.object({ schema: ZodSchema })` via Vercel AI SDK | Already used in worker.ts; handles retry, coercion, error types |
| Job queue with retry and dequeue | Custom polling loop or DB-based queue | BullMQ (already installed) | Durability, concurrency control, graceful shutdown already solved |
| Drizzle upsert | Manual SELECT → INSERT/UPDATE | `onConflictDoUpdate` / delete-then-insert pattern | Atomic; avoids race conditions on concurrent refreshes |
| CH PSC nationality classification | Re-implementing UK_NATURAL_PERSON_TERMS logic | Reuse/adapt `grounding.ts` classification code | Already handles corporate vs natural person distinction (D-07 requirement) |
| Co-supplier detection | LLM asking "did these firms work together?" | SQL: shared `ocid` on `procurement_records` | More reliable than LLM memory; OCDS data is already in DB; deterministic |
| ISO country code from free-text | Custom mapping table | ISO 3166-1 alpha-2: derive from CH `country_of_residence` or `jurisdiction` field (already present in PSC items) | CH returns structured country fields; no hand-roll needed |

**Key insight:** Phase 4's complexity is coordination complexity (five record types, two job types, multiple UI surfaces), not technical novelty. The tech stack is identical to Phases 2-3; the work is applying established patterns to new schema shapes and UI sections.

---

## Common Pitfalls

### Pitfall 1: Risk Flags — Accumulation on Re-run

**What goes wrong:** Using `onConflictDoNothing` or `onConflictDoUpdate` on `risk_flags` without a reliable composite unique key leaves stale flags in the database when a firm's research is refreshed and the LLM extracts fewer flags.

**Why it happens:** If a firm initially has 3 risk flags and after re-research only 2 are found, the third flag remains in DB because there's no dedup key.

**How to avoid:** For `risk_flags`: wrap the re-extraction in a transaction — `DELETE FROM risk_flags WHERE firmId = ?` then `INSERT` fresh rows. Do not rely on upsert for this table.

**Warning signs:** A firm's profile shows a "resolved" risk still appearing after refresh.

### Pitfall 2: Conflict Pair Direction Inconsistency

**What goes wrong:** Storing conflict pairs as `(firmAId=X, firmBId=Y)` for one firm's extraction and `(firmAId=Y, firmBId=X)` for the counterpart's extraction creates duplicate rows with the unique index preventing proper upsert.

**Why it happens:** Each firm's cross-cutting job independently extracts conflict pairs involving that firm. Without a canonical ordering rule, the same pair may be inserted in two orderings.

**How to avoid:** Before inserting a conflict pair, enforce: `firmAId = MIN(firmId1, firmId2)` and `firmBId = MAX(firmId1, firmId2)` by lexicographic comparison. The unique index on `(firmAId, firmBId, conflictType)` then correctly deduplicates across both extractions.

**Warning signs:** Duplicate conflict pairs appearing in the matrix for the same two firms.

### Pitfall 3: LLM Extraction Fabricating Firm Names

**What goes wrong:** The LLM extraction prompt for conflict pairs asks "which other firms does this firm conflict with?" and the model fabricates firm names not present in the finding text.

**Why it happens:** LLM synthesis tendency; the topic-4 finding may mention firm names in passing and the model overgeneralises.

**How to avoid:** (1) Constrain the extraction prompt: "Extract ONLY named firms mentioned with explicit evidence of the conflict type in the following finding text. Do not infer or extrapolate." (2) After extraction, validate that the named firms exist in the `firms` table by canonical name match before storing — discard unmatched names.

**Warning signs:** `conflict_pairs` rows where `firmAId` or `firmBId` cannot be resolved to a real firm.

### Pitfall 4: Cross-Cutting Job Failing Silently on Missing Findings

**What goes wrong:** If a firm was researched before Phase 4 topics 3/4/6/7 existed, those `findings` rows are absent. The cross-cutting extractor silently produces no records.

**Why it happens:** The extractor reads findings by topic name lookup. If topics were not yet seeded or the firm's research pre-dates them, the findings rows don't exist.

**How to avoid:** In `executeCrossCuttingJob`, after reading findings: if fewer than N findings are found, write a `progressMessage` noting which topics are missing. Do not fail the job — proceed with whatever findings exist and write explicit empty-state records where findings are absent (per the "not found is explicit" pattern from Phase 2).

**Warning signs:** A firm with complete research shows empty cross-cutting sections with no explanation.

### Pitfall 5: `/analysis` Page Conflict Matrix with Many Firms

**What goes wrong:** CSS Grid for a conflict matrix with 12+ firms becomes very wide and overflows the viewport without horizontal scroll.

**Why it happens:** CSS Grid with `n` columns scales with `n`; 12 firms creates a 13×13 grid (header + 12 firms each way).

**How to avoid:** Wrap the matrix in `overflow-x-auto`. Per UI-SPEC: the matrix is already specified with `overflow-x-auto` wrapper. Cell minimum size `min-w-10 min-h-10` (40px) means a 12-firm matrix is ~520px wide — scrollable on narrow viewports.

**Warning signs:** Matrix cells collapse or overlap; horizontal scroll not appearing.

### Pitfall 6: Jobs API Missing `jobType` Field

**What goes wrong:** The `/jobs` page currently renders all jobs with a static "Research" label. Adding `cross-cutting-analysis` jobs without extending the `jobs` schema to include a `jobType` column means the UI cannot distinguish the two types.

**Why it happens:** The current `jobs` table has no `jobType` column (confirmed by reading `schema.ts`).

**How to avoid:** Add a `jobType` column (`text`, values `"research" | "cross-cutting-analysis"`, default `"research"`) to the `jobs` table as part of the Phase 4 schema migration. Extend the `/api/jobs` route to return it. Extend the `/jobs` page to show the job type label per D-12.

**Warning signs:** All jobs on `/jobs` page show "Research" label even after Phase 4 ships.

---

## Code Examples

### Firm-Pair Canonical Ordering

```typescript
// Source: established DB pattern for pairwise dedup — adapted for Phase 4
// Ensures conflict_pairs and partnership_pairs have exactly one row per pair
function canonicalPair(firmId1: string, firmId2: string): [string, string] {
  return firmId1 < firmId2
    ? [firmId1, firmId2]
    : [firmId2, firmId1];
}
// Usage: const [firmAId, firmBId] = canonicalPair(extractedFirmAId, extractedFirmBId);
```
[ASSUMED — implementation detail; the ordering rule is the critical constraint]

### Conflict Pair Query for Firm Profile

```typescript
// Source: Drizzle or() pattern — query conflict pairs where this firm is either participant
import { or, eq } from "drizzle-orm";

const firmConflicts = await db
  .select()
  .from(conflictPairs)
  .where(
    or(
      eq(conflictPairs.firmAId, firmId),
      eq(conflictPairs.firmBId, firmId),
    )
  );
```
[ASSUMED — Drizzle `or()` syntax; verify against installed drizzle-orm@0.45.x docs]

### Risk Flags — Delete-Then-Insert in Transaction

```typescript
// Source: Drizzle transaction pattern — established for atomic multi-step writes
await db.transaction(async (tx) => {
  await tx.delete(riskFlags).where(eq(riskFlags.firmId, firmId));
  if (extractedFlags.length > 0) {
    await tx.insert(riskFlags).values(extractedFlags.map(f => ({ firmId, ...f })));
  }
});
```
[ASSUMED — Drizzle transaction API; adapt to drizzle-orm@0.45.x if syntax differs]

### Ownership Column in ComparisonTable

```typescript
// Source: src/components/dashboard/comparison-table.tsx — extend existing columns array
// Add after contractCount column, before actions column:
{
  accessorKey: "ownershipCountry",   // from extended ComparisonRow type
  header: "Ownership",
  cell: ({ row }) => {
    const country = row.original.ownershipCountry;
    if (!country) return <span className="text-neutral-400 font-mono text-xs">—</span>;
    const isUK = country.toUpperCase() === "UK";
    return (
      <Badge variant="outline" className={cn(
        "text-xs font-mono px-1.5 py-0.5 border",
        isUK ? "bg-green-100 text-green-700 border-green-200"
              : "bg-amber-100 text-amber-700 border-amber-200"
      )}>
        {isUK ? "UK" : country.toUpperCase()}
      </Badge>
    );
  },
},
```
[ASSUMED — exact implementation; the pattern follows existing capability badge code]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQLite (original Phase 1) | PostgreSQL 16 | db-worker-upgrade branch (merged pre-Phase 3) | Drizzle queries use `pgTable`, not `sqliteTable`; relevant for schema extension |
| `child_process.spawn()` per job | BullMQ + Redis | db-worker-upgrade branch | Phase 4 adds a second BullMQ queue/worker; the same pattern applies |
| `import "server-only"` in lib/ | Removed from lib/ | Phase 2 decision | New `src/lib/cross-cutting/` files must NOT use `"server-only"` |
| Radix `asChild` API (shadcn default) | Base UI render-prop API | Phase 1 decision | All new shadcn component usage must use `render={<Component />}` prop, not `asChild` |
| Zod v3 `.errors` | Zod v4 `.issues` | Phase 1 discovery | Zod 4.4.3 is installed; use `.issues` not `.errors` in validation error handling |
| `ai` SDK v4 | `ai` SDK v6 (`generateText`, `Output.object`) | Pre-Phase 2 | `generateObject` from v4 is replaced by `generateText` with `Output.object({ schema })` in v6 |

**Deprecated/outdated:**
- `generateObject` from AI SDK v4: replaced by `generateText({ output: Output.object({ schema }) })` in SDK v6 — confirmed by existing worker.ts implementation.
- `onConflictDoNothing` for re-extractable records: appropriate only for accumulated records (OCDS dedup). Use `onConflictDoUpdate` for singleton records (ownership, collaboration) and delete-then-insert for list records (risk flags).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `risk_flags` should use delete-then-insert rather than upsert | Architecture Patterns / Common Pitfalls | If a composite unique can be defined reliably, upsert is cleaner; adapt at implementation time |
| A2 | Two separate BullMQ queues (one for research, one for cross-cutting-analysis) | Architecture Patterns | Could be one queue with a `jobType` discriminator in the payload; either works; separate queues have cleaner type safety |
| A3 | `collaborationRecords` is one-row-per-firm (summary only) | Architecture Patterns | Could be one-row-per-evidence-item if multiple collaboration events need separate tracking; simplify at implementation time |
| A4 | Drizzle `or()` syntax for querying conflict_pairs where firmId is either participant | Code Examples | Verify against drizzle-orm@0.45 API; may need `.where(sql\`...\`)` for complex OR |
| A5 | `collaboration_records` does not need to store individual co-supplier evidence items (those are in `partnership_pairs`) | Architecture Patterns | If the profile UI needs individual items for collaboration history, the query joins `partnership_pairs` for that firm instead of a separate field |

---

## Open Questions

1. **`jobs` table `jobType` column migration**
   - What we know: current `jobs` schema has no `jobType` column (confirmed reading schema.ts)
   - What's unclear: whether `drizzle-kit push` can add a nullable column with a default value without breaking existing rows
   - Recommendation: add `jobType text NOT NULL DEFAULT 'research'` — Postgres supports default on new column addition without requiring a full table rewrite

2. **LLM extraction for conflict pairs — how to resolve firm names to IDs**
   - What we know: topic-4 finding contains firm names as text; the DB has canonical names in `firms.canonicalName` and aliases in `firms.aliases`
   - What's unclear: whether the extraction LLM will produce canonical names reliably vs variations
   - Recommendation: after extraction, run a fuzzy match against `firms.canonicalName` and `firms.aliases` (JSON array); discard pairs where either firm cannot be resolved; log unresolved names for debugging

3. **Cross-cutting extraction job — should it re-fetch CH PSC data or use cached ownership from grounding.ts?**
   - What we know: `grounding.ts` already calls the CH API live per research run; Phase 4 ownership extraction is supposed to persist the structured record
   - What's unclear: whether the cross-cutting job should re-call the CH API or use the data already in the cached finding text
   - Recommendation: call CH API directly in the cross-cutting job (same as grounding.ts pattern) to get current PSC data; this is consistent with D-07's requirement to use CH PSC as the primary source and keeps the ownership record current independently of finding age

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Drizzle schema extension, new tables | Must be running | 16 (docker-compose) | None — required |
| Redis | BullMQ cross-cutting queue | Must be running | 7 (docker-compose) | None — required |
| Anthropic API key | LLM extraction pass | Set in .env.local | — | Cannot extract without it |
| Companies House API key | Ownership extraction (CH PSC re-fetch) | Set in .env.local | — | Extraction falls back to topic-6 AI finding only |
| Node.js / tsx | Worker process | ✓ | 20+ (from package.json scripts) | — |

**Missing dependencies with no fallback:** PostgreSQL and Redis must be running (`docker compose up -d db redis`) before Phase 4 execution. This is the same prerequisite as Phases 2-3.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.8 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-04 | Ownership record written correctly for UK firm (PSC jurisdiction = UK) | unit | `npx vitest run src/lib/cross-cutting/extractor.test.ts` | Wave 0 |
| PROF-04 | Ownership record written correctly for foreign firm (PSC jurisdiction != UK) | unit | `npx vitest run src/lib/cross-cutting/extractor.test.ts` | Wave 0 |
| PROF-05 | Risk flags extracted with severity and date from topic-3 finding | unit | `npx vitest run src/lib/cross-cutting/extractor.test.ts` | Wave 0 |
| PROF-05 | Risk flags deleted and re-inserted on re-extraction | unit | `npx vitest run src/lib/cross-cutting/extractor.test.ts` | Wave 0 |
| ANAL-01 | Conflict pairs stored with canonical ordering (firmAId < firmBId) | unit | `npx vitest run src/lib/cross-cutting/extractor.test.ts` | Wave 0 |
| ANAL-01 | Conflict pair extraction outputs empty array when topic-4 has no named evidence | unit | `npx vitest run src/lib/cross-cutting/extractor.test.ts` | Wave 0 |
| ANAL-02 | Co-supplier detection: SQL query returns pair when two firms share an ocid | unit | `npx vitest run src/lib/cross-cutting/co-supplier.test.ts` | Wave 0 |
| ANAL-03 | getComparisonRows includes ownershipCountry from ownership_records join | unit | `npx vitest run src/lib/queries/comparison-rows.test.ts` | Exists — extend |
| ANAL-04 | executeCrossCuttingJob is enqueued after research job transitions to done | unit | `npx vitest run src/lib/jobs/runner.test.ts` | Wave 0 |

### Wave 0 Gaps

- [ ] `src/lib/cross-cutting/extractor.test.ts` — covers PROF-04, PROF-05, PROF-07, ANAL-01 extraction logic (mock `generateText`, verify DB writes)
- [ ] `src/lib/cross-cutting/co-supplier.test.ts` — covers ANAL-02 SQL co-supplier detection (mock DB, verify pair discovery)
- [ ] `src/lib/jobs/runner.test.ts` — covers ANAL-04 (verify `crossCuttingQueue.add` is called after research job transitions to done)
- [ ] `src/lib/cross-cutting/schemas.ts` — Zod schemas for all 5 extracted record types (needed by extractor.ts before tests can run)

Existing test infrastructure (`vitest.config.ts`, `vitest.setup.ts`, `vi.hoisted()` pattern) covers all new test files — no framework gaps.

---

## Security Domain

> `workflow.security_enforcement: true`, `security_asvs_level: 1` — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surface in Phase 4 |
| V3 Session Management | No | No new session surface |
| V4 Access Control | No | Single-user local tool; no multi-user access control |
| V5 Input Validation | Yes | Zod schemas validate all LLM-extracted output before DB insert; firm name resolution rejects unmatched names |
| V6 Cryptography | No | No new crypto surface |

### Known Threat Patterns for Phase 4 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM prompt injection via firm research findings | Tampering | Findings are written by our own research worker; treat as semi-trusted. Extraction prompts should be system-role instructions, not user-role (minimises injection surface). |
| Fabricated firm names in conflict pair extraction | Tampering / Information Disclosure | Post-extraction validation: resolve extracted firm names against `firms` table; discard unresolvable names (Pitfall 3 above). |
| SSRF via ownershipSection CH external link | Elevation of Privilege | URL is hardcoded pattern: `https://find-and-update.company-information.service.gov.uk/company/{chNumber}` with only `chNumber` user-supplied. CH number is alphanumeric, stored from user input — validate format (8 chars, alphanumeric) before interpolating into URL. |
| SQL injection via firm name search in co-supplier query | Tampering | Use Drizzle parameterised queries exclusively (confirmed pattern throughout codebase) — never string-interpolated SQL. |

---

## Sources

### Primary (HIGH confidence — from codebase inspection)
- `src/db/schema.ts` — confirmed existing table structures and constraints [VERIFIED: codebase]
- `src/scripts/worker-process.ts` — confirmed BullMQ worker pattern and job dispatch [VERIFIED: codebase]
- `src/lib/jobs/bull.ts` — confirmed queue config pattern [VERIFIED: codebase]
- `src/lib/jobs/runner.ts` — confirmed job lifecycle and trigger location [VERIFIED: codebase]
- `src/lib/research/worker.ts` — confirmed generateText + Output.object pattern [VERIFIED: codebase]
- `src/lib/research/grounding.ts` — confirmed PSC classification logic reusable for ownership [VERIFIED: codebase]
- `src/lib/clients/companies-house.ts` — confirmed CH API client and PSC schema [VERIFIED: codebase]
- `src/components/dashboard/comparison-table.tsx` — confirmed column extension approach [VERIFIED: codebase]
- `src/components/app-sidebar.tsx` — confirmed sidebar nav pattern [VERIFIED: codebase]
- `package.json` — confirmed all dependency versions [VERIFIED: codebase]
- `04-CONTEXT.md` — confirmed all locked decisions [VERIFIED: codebase]
- `04-UI-SPEC.md` — confirmed component inventory, copy, and interaction contract [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Vercel AI SDK v6 `Output.object` pattern — inferred from `worker.ts` implementation [VERIFIED: codebase usage]
- Drizzle `onConflictDoUpdate` pattern — documented in `findings` table upsert in `worker.ts` [VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages confirmed from package.json; no new packages needed
- Architecture: HIGH — patterns directly inferred from existing Phase 2/3 implementations in codebase
- Schema design: MEDIUM — new table shapes are inferred from requirements; exact column types and constraint names are [ASSUMED] pending implementation review
- Pitfalls: HIGH — derived from concrete code patterns and established constraints in CONTEXT.md

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (30 days — stable stack, no fast-moving dependencies in Phase 4)
