---
phase: 03-dashboard-profiles
plan: 02
subsystem: ui
tags: [nextjs, react, drizzle, tanstack-table, shadcn, typescript, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-research-engine
    provides: runResearch server action, jobs queue, /api/research/status polling
  - phase: 03-01
    provides: /firms/[id] profile route, StalenessBadge, FirmRefreshAction (profile variant)
  - phase: 01-data-foundation
    provides: firms/procurementRecords schema, db client, types, ComparisonTable skeleton

provides:
  - getComparisonRows query (firms + contractCount aggregation)
  - ComparisonRow type (Firm + contractCount)
  - Extended ComparisonTable: firm-name links, Research Status, Contract Count, Actions column
  - ComparisonTableFilter: capability tag toggle bar (OR logic, all-when-empty)
  - FirmRefreshAction (dashboard variant): icon-only ghost button with polling + toast lifecycle

affects: [dashboard homepage /, comparison-table, firm navigation to /firms/[id]]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-query merge: select all firms + select count(*) by firmId, joined in JS for contractCount"
    - "TanStack filterFn with autoRemove for capability tag OR filtering"
    - "columnFilters synced to activeTags via useEffect (controlled filter state pattern)"
    - "TDD: vi.hoisted + vi.mock for DB client isolation in comparison-rows.test.ts"

key-files:
  created:
    - src/lib/queries/comparison-rows.ts
    - src/lib/queries/comparison-rows.test.ts
    - src/components/dashboard/comparison-table-filter.tsx
    - src/components/dashboard/firm-refresh-action.tsx
  modified:
    - src/components/dashboard/comparison-table.tsx
    - src/app/page.tsx

key-decisions:
  - "Two-query merge approach for contractCount: select all firms + grouped count query, joined in JS — avoids LEFT JOIN complexity with Drizzle SQLite dialect and keeps queries individually testable"
  - "ComparisonTableFilter and FirmRefreshAction co-committed with comparison-table.tsx (Task 2 commit) since they are tightly coupled imports required for tsc to pass"
  - "capabilityTagFilterFn with autoRemove: zero activeTags removes the filter entirely, returning all firms (DASH-02 all-when-empty spec)"
  - "columnFilters state synced to activeTags via useEffect: ensures TanStack Table filter state stays in sync with the toggle button state"

patterns-established:
  - "Dashboard FirmRefreshAction: variant='ghost' size='sm' icon-only button vs profile page text button"
  - "Comparison table filter pattern: useState<CapabilityTag[]> → useEffect → setColumnFilters"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

# Metrics
duration: ~4min
completed: 2026-06-14
---

# Phase 3 Plan 02: Dashboard Enhancements Summary

**Cross-firm comparison table extended with clickable firm-name links, research status, contract count, capability tag filter bar (OR logic), sortable columns, and per-row Refresh Research action**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-14T16:47:43Z
- **Completed:** 2026-06-14T16:51:00Z
- **Tasks:** 3 (Task 1 TDD: 2 commits; Tasks 2+3: 1 combined commit)
- **Files modified:** 4 created, 2 modified

## Accomplishments

- `getComparisonRows()` query returns every firm augmented with `contractCount` — 3 unit tests passing via TDD (vi.hoisted mock pattern)
- `FirmRefreshAction` (dashboard variant) — icon-only ghost Button with RefreshCw icon, tooltip "Refresh Research" / "Refreshing...", polling lifecycle, toast success/error per UI-SPEC copywriting
- `ComparisonTableFilter` — "Filter by capability:" label + Nuclear/Infrastructure/Consultancy toggle buttons with semantic active colors; OR logic, all-when-empty
- Extended `ComparisonTable`: firm-name `<Link>` to `/firms/[id]` (blue-600 + hover:underline), StalenessBadge column, contractCount column, Actions column, `getFilteredRowModel` + `getSortedRowModel` wired
- `page.tsx` switched from `db.select().from(firms)` to `getComparisonRows()` with `rows` prop
- All DASH-01/02/03/04 success criteria verified; `npx next build` clean

## Task Commits

1. **Task 1 RED: getComparisonRows failing tests** — `0ef255d` (test)
2. **Task 1 GREEN: getComparisonRows implementation** — `71c98ce` (feat)
3. **Tasks 2+3: FirmRefreshAction, dashboard wiring, extended ComparisonTable, ComparisonTableFilter** — `91d26c8` (feat)

## Files Created/Modified

- `src/lib/queries/comparison-rows.ts` — getComparisonRows(): two-query merge returning ComparisonRow[]
- `src/lib/queries/comparison-rows.test.ts` — 3 unit tests (firm fields preserved, contractCount accuracy, zero-record firms)
- `src/components/dashboard/firm-refresh-action.tsx` — icon-only ghost Button, runResearch polling, toast lifecycle (DASH-04)
- `src/components/dashboard/comparison-table-filter.tsx` — "Filter by capability:" label + 3 toggle buttons, active/inactive styling
- `src/components/dashboard/comparison-table.tsx` — extended: ComparisonRow prop, Link firm name, StalenessBadge, contractCount, Actions, capabilityTagFilterFn, getFilteredRowModel
- `src/app/page.tsx` — uses getComparisonRows(), rows prop to ComparisonTable

## Decisions Made

- Two-query merge for `contractCount`: select all firms + `SELECT firmId, count(*) FROM procurementRecords GROUP BY firmId`, merged in JS with a Map. Avoids LEFT JOIN complexity in Drizzle SQLite and keeps each query testable in isolation.
- `ComparisonTableFilter` and `FirmRefreshAction` components were created as part of the Task 2 commit (not separate Task 3 commit) because `comparison-table.tsx` imports them — co-committing was the only way to pass `tsc --noEmit` for Task 2's verification gate.
- `capabilityTagFilterFn.autoRemove = (val) => !val || val.length === 0` ensures TanStack Table removes the filter entirely when no tags are active (zero-active = all firms spec).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written with one structural note:

**1. [Plan Sequencing] Filter bar created alongside Task 2, not as a separate Task 3 commit**
- **Found during:** Task 2 verification gate (`npx tsc --noEmit`)
- **Issue:** `comparison-table.tsx` imports `ComparisonTableFilter` — creating the table in Task 2 without the filter causes a TS module-not-found error
- **Fix:** Created the full `comparison-table-filter.tsx` in the Task 2 commit; Task 3 verified acceptance criteria with no additional code changes needed
- **Impact:** No scope change — all Task 3 artifacts exist and all acceptance criteria pass

---

**Total deviations:** 0 bugs / 0 rule violations. One sequencing adjustment (filter created in Task 2 commit).

## Known Stubs

None — all components receive live data. `getComparisonRows()` reads from the DB; `contractCount` reflects actual `procurementRecords` count; filter is fully wired via TanStack `getFilteredRowModel`.

## Threat Flags

None — all files created are within the scope declared in the plan's threat model. No new network endpoints, auth paths, or schema changes. T-03-05/06/07/08 mitigations applied as specified.

## Self-Check: PASSED

- FOUND: src/lib/queries/comparison-rows.ts
- FOUND: src/lib/queries/comparison-rows.test.ts
- FOUND: src/components/dashboard/firm-refresh-action.tsx
- FOUND: src/components/dashboard/comparison-table-filter.tsx
- FOUND: src/components/dashboard/comparison-table.tsx
- FOUND: src/app/page.tsx
- FOUND commit 0ef255d (test RED)
- FOUND commit 71c98ce (feat GREEN)
- FOUND commit 91d26c8 (feat Tasks 2+3)

---
*Phase: 03-dashboard-profiles*
*Completed: 2026-06-14*
