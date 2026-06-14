---
phase: 01-data-foundation
verified: 2026-06-14T10:15:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `npm run dev`, open localhost:3000 — confirm the persistent sidebar (Dashboard, Firms, Topics, disabled Analysis/Consortium) renders on every route and collapses to a 56px icon rail via the header toggle."
    expected: "Sidebar renders persistently across all routes; collapse/expand works; tooltips show labels in collapsed state; active route shows blue-600 indicator; Analysis and Consortium items appear greyed/disabled."
    why_human: "Sidebar collapse/expand is interactive behaviour and visual state that cannot be verified by grep or a production build check."
  - test: "Open /firms — verify seeded firms appear in the TanStack Table with correct capability badge colours (Nuclear=amber, Infrastructure=sky, Construction=violet) and CH numbers right-aligned in mono font."
    expected: "12 seeded firms displayed; badges use the correct tint colours; CH numbers render in monospace and are right-aligned; 3 firms (Framatome UK, GE Hitachi, Orano UK) show a dash/null placeholder."
    why_human: "Badge colour fidelity and font-family rendering require visual inspection."
  - test: "Click Add Firm; fill the form with a firm name, CH number, and at least one capability tag; submit. Confirm the new firm appears in the list. Restart the dev server (`Ctrl-C`, `npm run dev`) and confirm the firm is still present."
    expected: "Firm added toast appears; firm is in the list; after restart the firm is still present (SQLite persistence)."
    why_human: "End-to-end persistence across a restart requires a live server session."
  - test: "Click Edit on a seeded firm; change the name; click Save Changes. Verify the updated name appears in the list. Then click Delete on the same firm; confirm the AlertDialog says 'Delete firm?' with the exact copy; confirm the firm is gone after deletion."
    expected: "'Changes saved' toast after edit; updated name reflected immediately. AlertDialog shows exact copy 'Delete firm?' / 'Remove [Firm name] and its cached procurement and research data? This can't be undone.' with a red Delete button. Firm is absent from the list after deletion."
    why_human: "Interactive modal flow and exact copy verification require manual inspection."
  - test: "Open /topics; add a topic; edit it; delete it via the AlertDialog. Verify the 'Delete topic?' copy matches UI-SPEC ('Remove [Topic name]? Findings tied to this topic will be removed in future research runs.')."
    expected: "Topics CRUD fully functional; AlertDialog shows correct destructive copy; toasts confirm each action."
    why_human: "Interactive CRUD flow and exact copy on AlertDialog cannot be verified programmatically."
  - test: "Open the Add Firm dialog; type a company name into the CH number field (e.g. 'Babcock'); click the search icon. Verify results appear from Companies House and clicking a result auto-fills the CH number field."
    expected: "Results list appears (requires COMPANIES_HOUSE_API_KEY in .env.local); selecting a result fills the CH number; manual entry remains editable."
    why_human: "Live external API call requiring a valid API key and interactive result selection."
  - test: "Set a valid COMPANIES_HOUSE_API_KEY in .env.local; click the Refresh icon on a seeded firm that has a CH number (e.g. AtkinsRéalis); verify the spinner appears, then a success toast 'Procurement data refreshed' shows."
    expected: "Spinner animates while refresh runs; success toast appears when done; job row is created in the jobs table (verifiable: `node -e \"const Database=require('better-sqlite3');const db=new Database('./data/app.db');console.log(db.prepare('select status,firm_id from jobs').all())\"`)."
    why_human: "Live external API fetch requiring valid API key; UI spinner and toast are interactive and must be visually confirmed."
---

# Phase 1: Data Foundation — Verification Report

**Phase Goal:** Deliver the walking skeleton + full Phase 1 configuration surface + UK data layer so the dashboard is fully configurable (firms + topics CRUD) and has trustworthy, cached, verifiable procurement data per firm.
**Verified:** 2026-06-14T10:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add, edit, and remove firms (name, capability tags, Companies House number) and research topics via the UI | ✓ VERIFIED | `createFirm` / `updateFirm` / `deleteFirm` in `src/lib/actions/firm-actions.ts`; all use Zod + Drizzle parameterised queries + `revalidatePath`. `createTopic` / `updateTopic` / `deleteTopic` in `src/lib/actions/topic-actions.ts`. `FirmFormDialog` accepts optional `firm` prop for edit mode. `AlertDialog` with exact UI-SPEC copy in `firms-table.tsx` and `topics-table.tsx`. `npm run build` exits 0. |
| 2 | On first run the app is pre-seeded with the initial 12 firms and 7 topics | ✓ VERIFIED | `src/db/seed.ts` defines exactly 12 firms and 7 topics. `data/app.db` live DB: `firms=12 topics=7` (verified via better-sqlite3 query). Seed is idempotent (checks `existingFirms.length > 0` before inserting). |
| 3 | For a given firm, the system retrieves Companies House ownership/PSC data plus Contracts Finder and Find a Tender records, matched by Companies House number rather than name | ✓ VERIFIED | `refreshFirm` in `refresh-actions.ts` calls `getCompanyProfile` + `getPSC` (by `companiesHouseNumber`); `fetchContractsFinder` + `fetchFindATender` return raw OCDS; `upsertProcurementRecords` uses `matchFirmToSupplier` with CH-number as primary signal. `matchFirmToSupplier` in `ocds.ts` explicitly guards: CH-number match first, alias fuzzy-match only as secondary. |
| 4 | Contract and procurement records are normalised into one internal shape and deduped across Contracts Finder and Find a Tender | ✓ VERIFIED | `normaliseOcdsRelease` maps both sources to `NormalisedNotice`; `upsertProcurementRecords` uses `onConflictDoNothing({ target: procurementRecords.ocid })` keyed on the UNIQUE `ocid` index in schema. 6/6 vitest tests pass including dedup-by-ocid test asserting one row for a shared `ocid` across both sources. |
| 5 | Retrieved raw payloads and config persist in the local cache and survive an app restart | ✓ VERIFIED (needs human for restart confirmation) | `data/app.db` exists on disk (confirmed). `rawJson` column in `procurementRecords` is NOT NULL text (schema verified). `better-sqlite3` persists synchronously to the file. `src/db/client.ts` uses `DATABASE_PATH ?? './data/app.db'` with `mkdirSync` guard. Live DB has 5 tables. Actual restart survival requires human verification (see Step 8). |

**Score: 11/11 must-haves verified** (against merged roadmap SCs + plan-level must-haves; human verification pending on interactive/runtime behaviors)

---

### Deferred Items

No items deferred to later phases.

---

### Required Artifacts

#### Plan 01-01 Must-Have Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | 5-table Drizzle schema | ✓ VERIFIED | Contains `export const firms`, `topics`, `procurementRecords` (uniqueIndex on `ocid`), `jobs` (nullable `topicId`, status enum), `findings` (NOT NULL `sourceUrl`, `sourceTitle`, `rawSnippet`, `confidence` enum). All per contract. |
| `src/db/seed.ts` | 12 firms + 7 topics; CH numbers confirmed or null+TODO | ✓ VERIFIED | 12 firms: 9 with confirmed 8-char CH numbers, 3 with null + TODO comments referencing the CH search URL. 7 topics. Idempotent. Live DB: firms=12 topics=7. |
| `src/db/client.ts` | better-sqlite3 + Drizzle singleton, exports `db` | ✓ VERIFIED | Exports `db`; reads `DATABASE_PATH ?? './data/app.db'`; `mkdirSync` guard; WAL mode. |
| `src/lib/actions/firm-actions.ts` | `createFirm` server action (real DB write) | ✓ VERIFIED | `"use server"`; Zod validation; `db.insert(firms).values(...).returning`; `revalidatePath('/firms')`. |
| `src/components/app-sidebar.tsx` | Persistent collapsible sidebar nav shell (>=30 lines) | ✓ VERIFIED | 120 lines. `<Sidebar collapsible="icon">` with Dashboard/Firms/Topics nav items and Analysis/Consortium disabled placeholders. Active route detection. Tooltip support. |
| `src/components/firms/firms-table.tsx` | TanStack Table firm list (>=30 lines) | ✓ VERIFIED | 273 lines. Uses `useReactTable` with `getCoreRowModel` + `getSortedRowModel`. Capability badges (amber/sky/violet), CH number in mono, sortable headers, `FirmRowRefresh` and `FirmFormDialog` in row actions. |

#### Plan 01-02 Must-Have Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/actions/topic-actions.ts` | `createTopic`, `updateTopic`, `deleteTopic` | ✓ VERIFIED | `"use server"`. All three functions: Zod validation, parameterised Drizzle insert/update/delete on `topics`, `revalidatePath('/topics')`. |
| `src/lib/actions/firm-actions.ts` | `updateFirm`, `deleteFirm` added | ✓ VERIFIED | `updateFirm(id, input)`: Zod validate, `db.update(firms).set(...).where(eq(firms.id, id))`, revalidates `/firms` and `/`. `deleteFirm(id)`: `db.delete(firms).where(eq(firms.id, id))`, revalidates both paths. |
| `src/components/topics/topics-table.tsx` | TanStack Table topic list (>=25 lines) | ✓ VERIFIED | 215 lines. Full TanStack Table with sortable columns, edit/delete row actions, destructive AlertDialog with exact UI-SPEC copy. |
| `src/components/dashboard/comparison-table.tsx` | Read-only cross-firm comparison table (>=25 lines) | ✓ VERIFIED | 190 lines. Read-only sortable TanStack Table. Capability badges (reuses amber/sky/violet palette). CH number right-aligned mono. No filter/refresh controls (Phase 1 scope). |

#### Plan 01-03 Must-Have Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/clients/companies-house.ts` | Typed CH client: `getCompanyProfile`, `getPSC`, `searchCompanies` | ✓ VERIFIED | `import "server-only"`. Exports `getCompanyProfile`, `getPSC`, `getOfficers`, `searchCompanies`. HTTP Basic auth from `COMPANIES_HOUSE_API_KEY` (base64 username + blank password). Zod-validated responses with `.passthrough()`. Hard-coded GOV.UK base URL. |
| `src/lib/adapters/ocds.ts` | OCDS normalisation + dedup adapter | ✓ VERIFIED | Exports `normaliseOcdsRelease`, `matchFirmToSupplier`, `upsertProcurementRecords`. `onConflictDoNothing` keyed on `procurementRecords.ocid`. CH-number primary match; alias fuzzy secondary. Tolerates empty supplier/missing dates without throwing. |
| `src/lib/jobs/queue.ts` | SQLite-backed job enqueue/claim/status | ✓ VERIFIED | `import "server-only"`. Exports `enqueueJob`, `getJob`, `updateJobStatus`. `enqueueJob` inserts pending row and returns id via `.returning`. Status transitions pending→running→done/failed. |
| `src/lib/actions/refresh-actions.ts` | `refreshFirm` server action wiring clients + adapter + job | ✓ VERIFIED | `"use server"`. Loads firm, `enqueueJob`, marks job running, calls CH profile+PSC (when CH number present), `fetchContractsFinder` + `fetchFindATender` in parallel, `upsertProcurementRecords` for each source, marks job done/failed, `revalidatePath`. Returns `{ ok, jobId, error? }`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/firms/page.tsx` | `src/db/client.ts` | `db.select().from(firms)` | ✓ WIRED | Line 11: `const allFirms = await db.select().from(firms).orderBy(firms.canonicalName)` — RSC direct read, no API hop. |
| `src/components/firms/firm-form-dialog.tsx` | `src/lib/actions/firm-actions.ts` | `createFirm` invocation on submit | ✓ WIRED | Line 162: `const result = await createFirm({...})` in add mode. |
| `src/lib/actions/firm-actions.ts` | `src/db/schema.ts` (firms) | `db.insert(firms)` | ✓ WIRED | Line 91: `await db.insert(firms).values({...}).returning` |
| `src/components/firms/firm-form-dialog.tsx` | `src/lib/actions/firm-actions.ts` | `updateFirm` in edit mode | ✓ WIRED | Line 145: `const result = await updateFirm(firm.id, {...})` when `isEditMode && firm`. |
| `src/components/firms/firms-table.tsx` | `src/lib/actions/firm-actions.ts` | `deleteFirm` via AlertDialog | ✓ WIRED | Line 37: `import { deleteFirm } from "@/lib/actions/firm-actions"`. Line 74: `const result = await deleteFirm(firm.id)`. |
| `src/app/page.tsx` | `src/components/dashboard/comparison-table.tsx` | RSC renders ComparisonTable from db firms query | ✓ WIRED | Line 12: `const allFirms = await db.select().from(firms)`. Line 45: `<ComparisonTable firms={allFirms} />`. |
| `src/lib/actions/refresh-actions.ts` | `src/lib/clients/companies-house.ts` | CH fetch by CH number | ✓ WIRED | Line 9: `import { getCompanyProfile, getPSC }`. Lines 58-59: `await getCompanyProfile(...)`, `await getPSC(...)` guarded by `companiesHouseNumber` presence. |
| `src/lib/adapters/ocds.ts` | `src/db/schema.ts` (procurementRecords) | `onConflictDoNothing` keyed on `ocid` | ✓ WIRED | Line 188: `.onConflictDoNothing({ target: procurementRecords.ocid })` — dedup at write time. |
| `src/components/firms/firm-row-refresh.tsx` | `src/lib/actions/refresh-actions.ts` | `refreshFirm` server action on click | ✓ WIRED | Line 14: `import { refreshFirm }`. Line 34: `const result = await refreshFirm(firmId)`. |
| `src/components/firms/ch-search-field.tsx` | `src/lib/actions/ch-search-actions.ts` | `searchCompaniesAction` (key stays server-side) | ✓ WIRED | Line 15: `import { searchCompaniesAction }`. Line 52: `const res = await searchCompaniesAction(query)`. CH key never touches client component. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `src/app/firms/page.tsx` | `allFirms` | `db.select().from(firms)` — RSC Drizzle query | Yes — `data/app.db` live with 12 rows confirmed | ✓ FLOWING |
| `src/app/page.tsx` | `allFirms` | `db.select().from(firms)` — RSC Drizzle query | Yes — same live DB | ✓ FLOWING |
| `src/app/topics/page.tsx` | `allTopics` | `db.select().from(topics)` — RSC Drizzle query | Yes — 7 rows confirmed in live DB | ✓ FLOWING |
| `src/components/dashboard/comparison-table.tsx` | `firms` prop | Passed from page.tsx RSC query | Yes — receives real array from DB read | ✓ FLOWING |
| `src/lib/actions/refresh-actions.ts` | CF/FTS releases | `fetchContractsFinder` + `fetchFindATender` outbound calls | Real HTTP calls to GOV.UK APIs — live execution requires API call (human spot-check) | ? NEEDS HUMAN (live API) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SQLite DB exists with all 5 tables | `node -e "...sqlite_master..."` | 5 tables: findings, firms, jobs, procurement_records, topics | ✓ PASS |
| Seed counts correct | `node -e "...count(*)..."` | firms=12, topics=7 | ✓ PASS |
| OCDS adapter unit tests pass (6 assertions) | `npx vitest run src/lib/adapters/ocds.test.ts` | 1 test file, 6 tests, all passed; duration 160ms | ✓ PASS |
| Production build exits 0 | `npm run build` | Compiled successfully; TypeScript passed; 3 routes generated (/, /firms, /topics) | ✓ PASS |
| TypeScript type-check | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| Live per-firm refresh and Search CH | Requires valid `COMPANIES_HOUSE_API_KEY` in .env.local | Cannot test without live credentials | ? SKIP (external service) |

---

### Probe Execution

No probes declared in plan files. No conventional `scripts/*/tests/probe-*.sh` found. Step 7c: SKIPPED (no probe scripts).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONF-01 | 01-01 | User can add a firm with name, capability tags, CH number via the UI | ✓ SATISFIED | `createFirm` server action with Zod + Drizzle insert; `FirmFormDialog` add mode; build passes. |
| CONF-02 | 01-02 | User can edit firm details (name, tags, CH number) | ✓ SATISFIED | `updateFirm` with parameterised `db.update`; `FirmFormDialog` edit mode (`firm` prop, "Save Changes" button); verified in codebase. |
| CONF-03 | 01-02 | User can remove a firm from the list | ✓ SATISFIED | `deleteFirm` with `db.delete` + `eq`; destructive `AlertDialog` with exact UI-SPEC copy in `firms-table.tsx`. |
| CONF-04 | 01-02 | User can add a research topic | ✓ SATISFIED | `createTopic` server action; `TopicFormDialog` add mode; `topics-table.tsx` Add Topic CTA. |
| CONF-05 | 01-02 | User can edit or remove a research topic | ✓ SATISFIED | `updateTopic` + `deleteTopic`; `TopicFormDialog` edit mode; destructive AlertDialog with "Delete topic?" copy. |
| CONF-06 | 01-01 | System pre-seeds 12 firms and 7 topics on first run | ✓ SATISFIED | `seed.ts` defines 12 firms + 7 topics; `data/app.db` live counts confirmed: firms=12, topics=7; idempotent. |
| DATA-01 | 01-03 | System queries Contracts Finder for published UK contracts per firm | ✓ SATISFIED | `fetchContractsFinder` in `src/lib/clients/contracts-finder.ts`; called by `refreshFirm`; pagination handled; no-auth OCDS endpoint. |
| DATA-02 | 01-03 | System queries Find a Tender for published UK procurement notices per firm | ✓ SATISFIED | `fetchFindATender` in `src/lib/clients/find-a-tender.ts`; `links.next` cursor pagination; same-host guard; called by `refreshFirm`. |
| DATA-03 | 01-03 | System queries Companies House for ownership/PSC data per firm | ✓ SATISFIED | `getCompanyProfile` + `getPSC` in `companies-house.ts`; HTTP Basic auth from `COMPANIES_HOUSE_API_KEY`; called in `refreshFirm` guarded by `companiesHouseNumber` presence. |
| DATA-04 | 01-03 | Firms matched to procurement records by Companies House number (not name alone) | ✓ SATISFIED | `matchFirmToSupplier` in `ocds.ts`: CH-number is the primary signal; alias fuzzy match is explicitly secondary. Unit test asserts CH-number match and non-match. |
| DATA-05 | 01-03 | Contract and procurement data deduped across Contracts Finder and Find a Tender | ✓ SATISFIED | `onConflictDoNothing({ target: procurementRecords.ocid })` in `upsertProcurementRecords`; backed by `uniqueIndex("procurement_records_ocid_unique").on(table.ocid)` in schema. Unit test: shared ocid across both sources yields exactly one row. |

**All 11 Phase 1 requirement IDs accounted for. No orphaned requirements.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/db/seed.ts` | 117, 122, 127, 137, 142, 147 | `TODO: confirm CH number` / `companiesHouseNumber: null` | ℹ INFO | 3 of 12 firms (Framatome UK, GE Hitachi, Orano UK) have null CH numbers with TODO comments. These are **not floating debt** — the plan explicitly required null for unconfirmable entries (Pitfall 2 guidance), the TODO comments include the CH search URL for follow-up, and the schema allows null. This is intentional, documented architectural data quality marking, not unresolved implementation debt. No blocker. |

No `TBD`, `FIXME`, or `XXX` markers found in any phase file. No unreferenced debt markers. No stub return values that flow to user-visible output without real data backing.

---

### Human Verification Required

#### 1. Sidebar Navigation UI

**Test:** Run `npm run dev`, open localhost:3000. Click between Dashboard, Firms, and Topics routes. Collapse and expand the sidebar using the header toggle button.
**Expected:** Sidebar persists on all routes; active route shows blue-600 left indicator; sidebar collapses to ~56px icon rail; tooltips show link labels in collapsed state; Analysis and Consortium items are greyed/disabled and non-clickable.
**Why human:** Interactive visual behaviour and collapse animation cannot be verified by static analysis or build output.

#### 2. Firms Table Visual Fidelity

**Test:** Open /firms, inspect the seeded firm list.
**Expected:** 12 firms visible; capability badges use amber tint for Nuclear, sky tint for Infrastructure, violet tint for Construction; CH numbers are right-aligned in monospace; 3 firms show a dash placeholder for the null CH number.
**Why human:** Badge colour fidelity and font-family rendering must be visually confirmed.

#### 3. Add Firm Persists Across Restart

**Test:** Click Add Firm, enter a firm name and CH number, submit. Confirm it appears. Restart the dev server (`Ctrl-C`, `npm run dev`). Confirm the new firm is still in the list.
**Expected:** "Firm added" toast; new firm in list; firm still present after restart.
**Why human:** Server restart persistence requires a live session.

#### 4. Firm Edit and Delete Flows

**Test:** Click Edit on any seeded firm; change the name; click Save Changes. Confirm name updates. Click Delete on a firm; read the AlertDialog copy carefully.
**Expected:** "Changes saved" toast and updated name. AlertDialog shows exactly: title "Delete firm?", body "Remove [Firm name] and its cached procurement and research data? This can't be undone.", red "Delete" button. Firm is gone after confirming.
**Why human:** Interactive modal flows and exact copy verification require manual inspection.

#### 5. Topics Full CRUD

**Test:** Open /topics; Add Topic; Edit it; Delete it. Read the delete AlertDialog copy.
**Expected:** All CRUD operations work with toasts. Delete AlertDialog shows "Delete topic?" / "Remove [Topic name]? Findings tied to this topic will be removed in future research runs."
**Why human:** Interactive flow and copy verification.

#### 6. Search CH Live Lookup

**Test:** Set `COMPANIES_HOUSE_API_KEY=<your_key>` in `.env.local`. Open Add Firm dialog; type "Babcock" in the CH number field; click the search icon.
**Expected:** Results list appears with matching Companies House entries; clicking a result auto-fills the CH number; field remains manually editable.
**Why human:** Live external API call requiring a valid API key; interactive result selection.

#### 7. Per-Firm Refresh (Live Data Pull)

**Test:** With a valid `COMPANIES_HOUSE_API_KEY` in `.env.local`, click the Refresh (circular arrow) icon on "Babcock International" (CH 02405425).
**Expected:** Spinner animates on the button; "Procurement data refreshed" success toast appears; a job row is created in `data/app.db` (query: `SELECT status, firm_id FROM jobs`); procurement records may be written if the firm matches any CF/FTS results.
**Why human:** Live external API fetch; interactive UI state (spinner, toast) must be visually confirmed.

---

### Gaps Summary

No gaps. All 11 must-haves are verified at the code level. The `status: human_needed` reflects 7 items requiring live session, visual inspection, or live API credentials to confirm — automated verification is complete.

---

_Verified: 2026-06-14T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
