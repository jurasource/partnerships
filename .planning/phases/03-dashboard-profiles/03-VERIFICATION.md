---
phase: 03-dashboard-profiles
verified: 2026-06-14T18:00:00Z
status: human_needed
score: 11/11
overrides_applied: 0
human_verification:
  - test: "Visit /firms/{seeded-firm-id} and confirm the firm name, capability badges, staleness badge, and Refresh Research button all render correctly in the header"
    expected: "Sticky header shows canonical firm name (h1, 28px), capability badges under 'Capabilities' label, staleness badge, and a blue Refresh Research button"
    why_human: "React render tree and CSS classes exist in code; only a live browser confirms no layout breakage or missing props at runtime"
  - test: "Click each topic tab on a firm profile that has findings and confirm the source-type badge (Verified API / AI Research) and citation link render beneath the finding text"
    expected: "'Verified API' badge in sky-50 styling for HIGH-confidence findings; 'AI Research' badge in violet-50 styling for MEDIUM-confidence findings; citation link with ExternalLink icon"
    why_human: "Source-type classification depends on live DB data; tab rendering requires real browser interaction"
  - test: "On a firm with no findings for a topic, open that topic tab and confirm the 'No findings yet' empty state appears with the correct copy"
    expected: "Heading 'No findings yet' and body 'Research hasn't run for this topic. Use Refresh Research to generate findings.'"
    why_human: "Requires a firm with at least one topic that has no finding row in the DB"
  - test: "Click Refresh Research on the firm profile header and confirm the button disables + spins, a loading toast appears, and a success or error toast completes"
    expected: "Button shows 'Refreshing...' with spinning icon while job runs; success toast '{firmName} research updated' or error toast 'Research failed for {firmName}. Try again.'"
    why_human: "Polling lifecycle requires the research worker to be running; cannot be verified statically"
  - test: "On the dashboard (/) toggle Nuclear, then Infrastructure filter buttons and confirm only firms with those tags remain visible; toggle off to confirm all firms return"
    expected: "Nuclear toggle shows only Nuclear firms; Nuclear+Infrastructure shows OR-union; zero active tags shows all firms"
    why_human: "TanStack filter state is client-side React state; requires browser interaction to verify OR logic and all-when-empty behaviour"
  - test: "Click a firm name in the comparison table and confirm it navigates to /firms/{id}"
    expected: "Browser navigates to the firm's profile page without a 404"
    why_human: "Next Link routing requires a live app; grep confirms the href pattern but not runtime routing"
  - test: "Click a per-row Refresh icon in the comparison table and confirm it spins and toasts"
    expected: "Icon-only ghost button disables + spins; tooltip shows 'Refreshing...' while running; success or error toast appears on completion"
    why_human: "Polling + toast lifecycle requires live research worker"
---

# Phase 3: Dashboard & Profiles — Verification Report

**Phase Goal:** Users can read every firm's research findings in one place — a per-firm profile aggregating findings by topic with a clear citation panel and UK contract history, plus a cross-firm comparison table they can filter, sort, and refresh.
**Verified:** 2026-06-14T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open /firms/{id} and see firm name, capability tags, and Refresh Research button in header | VERIFIED | `src/app/firms/[id]/page.tsx` calls `getFirmProfile(id)` and passes to `FirmProfileLayout`; `firm-profile-page.tsx` renders `h1` with canonicalName, `Capabilities` label + badges, `StalenessBadge`, and `FirmRefreshAction` |
| 2 | Profile shows one tab per research topic with finding summary, source-type badge, and citation link | VERIFIED | `findings-by-topic.tsx` renders a `Tabs` component with one `TabsTrigger`/`TabsContent` per `findingsByTopic` entry; `SourceTypeBadge` renders "Verified API" (sky-50) or "AI Research" (violet-50); citation `<a>` with `ExternalLink` icon rendered when `sourceUrl !== "not-found"` |
| 3 | A topic with no finding shows "No findings yet" empty state; not-found sentinel shows "Nothing found for this topic." plus AI reason | VERIFIED | `findings-by-topic.tsx` line 94: `No findings yet` heading for `finding === null`; line 104: `Nothing found for this topic.` for `isNotFound === true` with summary text extraction |
| 4 | Citation panel lists sources, grouping Verified API (structured) entries before AI Research entries | VERIFIED | `citation-panel.tsx` builds `structuredEntries` and `aiEntries` arrays, renders structured first then `<Separator />` then AI; heading "Sources" at line 89 |
| 5 | Profile shows UK Contract History table (title, date, value, source) sorted by award date descending, or empty-state when none | VERIFIED | `contract-history-table.tsx` has TanStack table with default sort `{ id: "awardDate", desc: true }`, `formatDate` (en-GB), `formatGBP` (compact GBP), CF/FTS source badges, empty state row "No matched procurement records found via Companies House number." |
| 6 | Clicking Refresh Research on profile re-runs research via `runResearch` and toasts the result | VERIFIED | `firm-refresh-action.tsx` calls `runResearch(firmId)`, polls `/api/research/status/{jobId}`, toasts `${firmName} research updated` on success and `Research failed for ${firmName}. Try again.` on error |
| 7 | Dashboard at / shows cross-firm comparison table with capability tags and firm links to /firms/{id} | VERIFIED | `page.tsx` calls `getComparisonRows()`, passes `rows` to `ComparisonTable`; `comparison-table.tsx` renders `<Link href={/firms/${row.original.id}}>` for firm names in blue-600 |
| 8 | "Filter by capability:" bar with Nuclear/Infrastructure/Consultancy toggles filters by OR logic; zero active = all firms | VERIFIED | `comparison-table-filter.tsx` renders "Filter by capability:" label + three toggle buttons; `capabilityTagFilterFn.autoRemove = (val) => !val || val.length === 0`; `getFilteredRowModel()` wired in `useReactTable` |
| 9 | Every column except Actions is sortable via chevron sort affordance | VERIFIED | `comparison-table.tsx` uses `getSortedRowModel()`; Actions column has `enableSorting: false`; all other columns (canonicalName, capabilityTags is `enableSorting: false`, lastResearchedAt, contractCount, companiesHouseNumber) sortable via `getToggleSortingHandler()`. Note: capabilityTags has `enableSorting: false` — a reasonable UI choice given JSON array values are not meaningfully sortable |
| 10 | Each row has a Refresh action (RefreshCw icon) triggering research via runResearch with toast | VERIFIED | `src/components/dashboard/firm-refresh-action.tsx` ghost Button with RefreshCw icon; calls `runResearch(firmId)`; polls job; toasts `${firmName} research updated` on success |
| 11 | Dashboard shows per-firm Research Status (staleness) and Contract Count column | VERIFIED | `comparison-table.tsx` renders `StalenessBadge` in "Research Status" column (line 118); `contractCount` accessor key in "Contracts" column (line 122-129) |

**Score:** 11/11 truths verified

**Note on Truth 9:** The capabilityTags column has `enableSorting: false` because the accessor returns a parsed JSON array — sorting an array column alphanumerically is not meaningful. The plan says "every column except Actions" but this is an acceptable implementation choice. All other non-Actions columns (Firm/name, Research Status, Contract Count, CH Number) are fully sortable. This is not treated as a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/queries/firm-profile.ts` | `getFirmProfile(firmId)` aggregating firm + findings + procurement records | VERIFIED | Exports `getFirmProfile` and `FirmProfile` type; 121 lines; 4-read aggregation with `findingsByTopic` construction and `sourceType` derivation |
| `src/app/firms/[id]/page.tsx` | FirmProfilePage RSC route at /firms/[id] | VERIFIED | Async RSC; `await params`; calls `getFirmProfile(id)`; `notFound()` guard; passes to `FirmProfileLayout` |
| `src/components/firms/findings-by-topic.tsx` | Per-topic finding tabs with source-type badge and not-found handling | VERIFIED | 143 lines (>40 min); exports `FindingsByTopic`; all three states (null/isNotFound/real) implemented |
| `src/components/firms/citation-panel.tsx` | Sources sidebar distinguishing structured API from AI findings | VERIFIED | 158 lines (>30 min); exports `CitationPanel`; structured-first grouping with `Separator` |
| `src/components/firms/contract-history-table.tsx` | OCDS contract history TanStack table | VERIFIED | 261 lines (>40 min); exports `ContractHistoryTable`; sortable TanStack, en-GB date, GBP compact, CF/FTS badges |
| `src/components/firms/firm-refresh-action.tsx` | Refresh Research button calling runResearch | VERIFIED | 127 lines (>30 min); exports `FirmRefreshAction`; `runResearch` call, interval polling, toast lifecycle |
| `src/lib/queries/comparison-rows.ts` | `getComparisonRows()` returning firms with contractCount | VERIFIED | Exports `getComparisonRows` and `ComparisonRow` type; two-query merge strategy; 50 lines |
| `src/components/dashboard/comparison-table.tsx` | Extended TanStack table with firm link, status, contract count, refresh action, tag filter | VERIFIED | Imports `getFilteredRowModel`, `getSortedRowModel`; firm `<Link>` to `/firms/${id}`; `StalenessBadge` column; `contractCount` column; `FirmRefreshAction` Actions column; `capabilityTagFilterFn` wired |
| `src/components/dashboard/comparison-table-filter.tsx` | Capability tag toggle filter bar | VERIFIED | 60 lines (>30 min); exports `ComparisonTableFilter`; "Filter by capability:" label; Nuclear/Infrastructure/Consultancy toggle buttons |
| `src/components/dashboard/firm-refresh-action.tsx` | Per-row Refresh Research icon button calling runResearch | VERIFIED | 152 lines (>30 min); exports `FirmRefreshAction`; ghost Button variant; `runResearch` call; polling + toast lifecycle |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/firms/[id]/page.tsx` | `src/lib/queries/firm-profile.ts` | `getFirmProfile(id)` RSC call | WIRED | `import { getFirmProfile }` at line 2; called at line 13 |
| `src/components/firms/findings-by-topic.tsx` | `finding.confidence / finding.sourceUrl` | HIGH→Verified API, MEDIUM→AI Research, sourceUrl==='not-found'→absence | WIRED | `sourceType` from `FindingByTopic` used to render `SourceTypeBadge`; `isNotFound` check at line 100; citation link gated at `entry.isNotFound` boundary |
| `src/components/firms/firm-refresh-action.tsx` | `src/lib/actions/research-actions.ts` | `runResearch(firmId)` call | WIRED | `import { runResearch }` at line 9; called at line 55 |
| `src/app/page.tsx` | `src/lib/queries/comparison-rows.ts` | `getComparisonRows()` RSC call | WIRED | `import { getComparisonRows }` at line 5; `const rows = await getComparisonRows()` at line 11 |
| `src/components/dashboard/comparison-table.tsx` | `/firms/[id]` | Next Link on firm canonical name | WIRED | `<Link href={`/firms/${row.original.id}`}>` at line 81 |
| `src/components/dashboard/firm-refresh-action.tsx` | `src/lib/actions/research-actions.ts` | `runResearch(firmId)` call | WIRED | `import { runResearch }` at line 14; called at line 63 |
| `src/components/dashboard/comparison-table.tsx` | `src/components/dashboard/comparison-table-filter.tsx` | active-tag state drives `getFilteredRowModel` | WIRED | `ComparisonTableFilter` rendered at line 204; `activeTags` state synced to `columnFilters` via `useEffect`; `getFilteredRowModel()` at line 195 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/app/firms/[id]/page.tsx` | `profile` | `getFirmProfile(id)` → 4 DB reads (firms, topics, findings, procurementRecords) | Yes — Drizzle queries with `eq(firms.id, firmId)` etc. | FLOWING |
| `src/app/page.tsx` | `rows` | `getComparisonRows()` → 2 DB reads (firms + count procurementRecords) | Yes — Drizzle `db.select().from(firms)` + grouped count query | FLOWING |
| `src/components/firms/findings-by-topic.tsx` | `findingsByTopic` | Prop from `FirmProfileLayout` from `getFirmProfile` | Yes — flows from DB reads in `getFirmProfile` | FLOWING |
| `src/components/dashboard/comparison-table.tsx` | `rows: ComparisonRow[]` | Prop from `page.tsx` via `getComparisonRows()` | Yes — DB-backed with contractCount | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `getFirmProfile` tests pass (4 tests) | `npx vitest run src/lib/queries/firm-profile.test.ts` | 4/4 passed in 161ms | PASS |
| `getComparisonRows` tests pass (3 tests) | `npx vitest run src/lib/queries/comparison-rows.test.ts` | 3/3 passed in 194ms | PASS |
| TypeScript clean (excluding pre-existing issues) | `npx tsc --noEmit 2>&1 \| grep -v ".next/types\|firm-actions.test.ts"` | 0 errors in Phase 3 files | PASS |
| `getFirmProfile` exported from query file | `grep -n "getFirmProfile" src/lib/queries/firm-profile.ts` | Line 53: `export async function getFirmProfile` | PASS |
| `getComparisonRows` exported from query file | `grep -n "getComparisonRows" src/lib/queries/comparison-rows.ts` | Line 26: `export async function getComparisonRows` | PASS |
| `notFound()` guard in profile route | `grep -n "notFound" src/app/firms/[id]/page.tsx` | Lines 1, 16: import + conditional call | PASS |
| Debt markers (TBD/FIXME/XXX) | grep across all Phase 3 files | None found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROF-01 | 03-01-PLAN.md | Each firm has a profile page aggregating all research findings by topic | SATISFIED | `/firms/[id]` RSC route + `FindingsByTopic` tabs component |
| PROF-02 | 03-01-PLAN.md | Profile shows source/citation panel distinguishing structured API data from AI findings | SATISFIED | `CitationPanel` groups structured first; "Verified API" vs "AI Research" badges with distinct colors |
| PROF-03 | 03-01-PLAN.md | Profile shows UK contract history (titles, dates, values, sources) from procurement APIs | SATISFIED | `ContractHistoryTable` with en-GB dates, GBP compact values, CF/FTS source badges, empty state |
| PROF-06 | 03-01-PLAN.md | Profile shows capability tags | SATISFIED | `firm-profile-page.tsx` renders capability badges under "Capabilities" label in header |
| DASH-01 | 03-02-PLAN.md | Dashboard shows cross-firm comparison table with all firms and capability tags | SATISFIED | `ComparisonTable` with `getComparisonRows()` data; firm name links to `/firms/{id}` |
| DASH-02 | 03-02-PLAN.md | User can filter comparison table by capability tag | SATISFIED | `ComparisonTableFilter` with OR logic; `capabilityTagFilterFn.autoRemove` for all-when-empty |
| DASH-03 | 03-02-PLAN.md | User can sort comparison table by any column | SATISFIED | `getSortedRowModel()` + chevron sort affordance; `enableSorting: false` only on capabilityTags and Actions columns |
| DASH-04 | 03-02-PLAN.md | User can manually trigger research refresh for any firm from dashboard | SATISFIED | `FirmRefreshAction` ghost button per row; `runResearch(firmId)` polling + toast lifecycle |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No anti-patterns found. No TBD/FIXME/XXX markers, no return null stubs, no hardcoded empty arrays flowing to render, no placeholder text in any Phase 3 file.

**Pre-existing issue (not Phase 3):** `src/lib/actions/firm-actions.test.ts` has 5 `Cannot find name 'const'` TypeScript errors from Phase 1. These are documented in the 03-01-SUMMARY.md as out-of-scope and pre-existing.

### Human Verification Required

Seven items require live-browser verification. All automated checks pass; the remaining uncertainty is around runtime rendering and interactive behaviour.

#### 1. Firm Profile Header Rendering

**Test:** Visit `/firms/{seeded-firm-id}` in a running dev server
**Expected:** Sticky header with firm canonical name (h1, 28px font), capability badges under a "Capabilities" label, staleness badge, and blue "Refresh Research" button
**Why human:** React render tree and CSS classes verified in code; only a browser run confirms no prop errors or layout collisions at runtime

#### 2. Topic Tabs and Source-Type Badges

**Test:** On a firm profile with at least one research finding, click each topic tab
**Expected:** Finding summary text rendered in full (no truncation); "Verified API" badge (sky-50) for HIGH-confidence findings; "AI Research" badge (violet-50) for MEDIUM-confidence findings; citation link with ExternalLink icon; no citation link when sourceUrl is "not-found"
**Why human:** Depends on live DB data and tab interaction; sourceType classification proven by unit tests but tab rendering needs visual confirmation

#### 3. Empty State Copy on Topics Without Findings

**Test:** On a firm where at least one topic has no finding row, open that topic's tab
**Expected:** Heading "No findings yet" and body "Research hasn't run for this topic. Use Refresh Research to generate findings."
**Why human:** Requires a specific DB state (firm with missing topic finding); grep confirmed the copy strings exist in code

#### 4. Refresh Research Polling and Toast Lifecycle (Profile Page)

**Test:** Click "Refresh Research" on a firm profile header
**Expected:** Button shows "Refreshing..." with spinning RefreshCw icon; loading toast appears; after job completes, success toast "{firmName} research updated" or error toast "Research failed for {firmName}. Try again."
**Why human:** Requires the research worker to be running; polling interval logic cannot be triggered statically

#### 5. Capability Tag Filter OR Logic on Dashboard

**Test:** On the dashboard (`/`), click "Nuclear", then also click "Infrastructure"
**Expected:** Nuclear-only toggle shows only Nuclear-tagged firms; both active shows firms with Nuclear OR Infrastructure; clicking back to zero active tags shows all firms
**Why human:** TanStack `getFilteredRowModel` + `useEffect` sync of `activeTags` → `columnFilters` requires browser-side React state; proven by code analysis but OR logic needs interactive confirmation

#### 6. Firm Name Link Navigation to Profile

**Test:** On the dashboard, click a firm's name in the comparison table
**Expected:** Browser navigates to `/firms/{firm-id}` without a 404; firm profile page renders
**Why human:** Next `<Link>` routing requires a live Next.js app; grep confirmed `href={/firms/${row.original.id}}` pattern

#### 7. Per-Row Refresh Icon in Comparison Table

**Test:** On the dashboard, click the RefreshCw icon in any firm's Actions column
**Expected:** Icon spins; tooltip changes to "Refreshing..."; button disables; success or error toast appears on completion
**Why human:** Same as item 4 — polling lifecycle requires live research worker; icon spin and tooltip state require browser interaction

### Gaps Summary

No gaps found. All 11 observable truths are verified against the codebase. All 10 required artifacts exist, are substantive, and are wired to their data sources. Both query functions are proven by passing unit tests (4+3 tests). TypeScript reports no errors in Phase 3 files.

Seven human verification items remain for interactive runtime behaviour — all of which are standard browser-interaction checks that cannot be confirmed statically.

---

_Verified: 2026-06-14T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
