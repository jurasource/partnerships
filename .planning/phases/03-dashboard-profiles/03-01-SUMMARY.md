---
phase: 03-dashboard-profiles
plan: 01
subsystem: ui
tags: [nextjs, react, drizzle, tanstack-table, shadcn, typescript, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-research-engine
    provides: runResearch server action, findings DB rows, procurementRecords, jobs queue
  - phase: 01-data-foundation
    provides: firms/topics/findings/procurementRecords schema, db client, types, StalenessBadge, ComparisonTable

provides:
  - getFirmProfile query (firm + findingsByTopic + contracts aggregation)
  - /firms/[id] RSC route with notFound() guard
  - FirmProfileLayout server component (header, findings tabs, citation panel, contract history)
  - FindingsByTopic client component (Tabs, empty/not-found/real-finding states, source-type badges)
  - CitationPanel server component (structured-first grouping, Verified API / AI Research badges)
  - ContractHistoryTable client component (TanStack table, en-GB date, GBP compact, CF/FTS badges)
  - FirmRefreshAction client component (runResearch polling, toast lifecycle)

affects: [03-02-dashboard-enhancements, comparison-table, firm navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getFirmProfile 4-read aggregation: firms→topics→findings→procurementRecords, joined in application layer"
    - "TDD with vi.hoisted for mock-hoisting across vitest module boundary"
    - "sourceType derivation: not-found sentinel → structured+isNotFound, MEDIUM → ai, HIGH → structured"
    - "RSC route: async params (Next.js 16 param unwrapping), notFound() for null profile"
    - "FirmRefreshAction mirrors FirmRowResearch polling pattern (setInterval + intervalRef cleanup)"

key-files:
  created:
    - src/lib/queries/firm-profile.ts
    - src/lib/queries/firm-profile.test.ts
    - src/app/firms/[id]/page.tsx
    - src/components/firms/firm-profile-page.tsx
    - src/components/firms/findings-by-topic.tsx
    - src/components/firms/citation-panel.tsx
    - src/components/firms/contract-history-table.tsx
    - src/components/firms/firm-refresh-action.tsx
  modified: []

key-decisions:
  - "vi.hoisted() required to share mock references across vitest module boundary (alternative to top-level variable + vi.mock factory)"
  - "Topics queried dynamically from DB (not hard-coded 7) — findingsByTopic length equals DB topic count"
  - "FirmProfileLayout takes raw ProcurementRecord[] from getFirmProfile; ContractHistoryTable receives ContractRow (subset shape) for flexibility"
  - "CitationPanel filters out null findings and not-found sentinels — only real sources appear in the sidebar"
  - "Citation links carry rel=noopener noreferrer + target=_blank (T-03-03 mitigation)"

patterns-established:
  - "Profile page pattern: RSC calls getFirmProfile → notFound() guard → pass to server layout component"
  - "Source-type badge classes: Verified API bg-sky-50 text-sky-700 border-sky-100 / AI Research bg-violet-50 text-violet-700 border-violet-100"
  - "isNotFound: true when finding.sourceUrl === 'not-found' (NOT_FOUND_SENTINEL detection)"

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-06]

# Metrics
duration: 10min
completed: 2026-06-14
---

# Phase 3 Plan 01: Firm Profile Vertical Slice Summary

**Per-firm profile at /firms/[id] with Tabs-based topic findings, Verified API vs AI Research citation sidebar, GBP contract history table, and Refresh Research action with job polling**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-14T16:34:00Z
- **Completed:** 2026-06-14T16:44:30Z
- **Tasks:** 3 (Task 1 TDD: 2 commits; Tasks 2+3: 1 commit each)
- **Files modified:** 8 created

## Accomplishments

- `getFirmProfile(firmId)` aggregates firm, per-topic findings with source-type classification, and procurement records — 4 unit tests passing via TDD (vi.hoisted mock pattern)
- `/firms/[id]` RSC route with `notFound()` guard, capability tag badges (PROF-06), staleness badge, and Refresh Research CTA wired to `runResearch` polling
- FindingsByTopic (Tabs), CitationPanel (structured-first grouping), ContractHistoryTable (TanStack, en-GB date, GBP compact), FirmRefreshAction — PROF-01/02/03 satisfied
- Threat mitigations T-03-01/02/03 applied: parameterised eq lookup, React auto-escaping, noopener noreferrer link attributes

## Task Commits

1. **Task 1 RED: getFirmProfile failing tests** - `6a402cd` (test)
2. **Task 1 GREEN: getFirmProfile implementation** - `b3024ab` (feat)
3. **Task 2: Profile route + findings-by-topic + citation panel + firm-refresh-action** - `eac5d06` (feat)
4. **Task 3: UK Contract History table** - `e0f5a5d` (feat)

## Files Created/Modified

- `src/lib/queries/firm-profile.ts` — getFirmProfile: 4-read aggregator returning FirmProfile type
- `src/lib/queries/firm-profile.test.ts` — 4 unit tests (null firm, per-topic entry count, sourceType classification, contracts ordering)
- `src/app/firms/[id]/page.tsx` — async RSC, await params, getFirmProfile, notFound()
- `src/components/firms/firm-profile-page.tsx` — FirmProfileLayout: header (name, capabilities, staleness, refresh) + body + contract history section
- `src/components/firms/findings-by-topic.tsx` — Base UI Tabs per topic, empty/not-found/real-finding states, SourceTypeBadge, citation link
- `src/components/firms/citation-panel.tsx` — structured entries first then AI, Tooltip for long URLs, noopener noreferrer
- `src/components/firms/contract-history-table.tsx` — TanStack sortable table, formatDate en-GB, formatGBP compact, CF/FTS badges, empty state
- `src/components/firms/firm-refresh-action.tsx` — Refresh Research button, runResearch call, setInterval polling, toast success/error

## Decisions Made

- Used `vi.hoisted()` to resolve vitest mock-hoisting limitation — the `mockSelect` variable must be created before `vi.mock()` factory executes.
- Topics queried dynamically from the `topics` table (not hard-coded 7 count) — findingsByTopic length equals whatever topics exist in DB.
- `ContractHistoryTable` accepts a `ContractRow` type (subset of `ProcurementRecord`) rather than the full ORM row, for interface cleanliness.
- Citation link omitted when `sourceUrl === "not-found"` (not-found sentinel) — consistent with T-03-03 and PROF-02 spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.hoisted() required for mock variable sharing**
- **Found during:** Task 1 GREEN (running tests after implementation)
- **Issue:** `vi.mock()` factory is hoisted before top-level variable declarations — `mockSelect` referenced in the factory before it was initialized, causing `ReferenceError: Cannot access 'mockSelect' before initialization`
- **Fix:** Wrapped `mockSelect = vi.fn()` in `vi.hoisted(() => ({ mockSelect }))` and destructured the result; the factory then correctly uses the hoisted reference
- **Files modified:** src/lib/queries/firm-profile.test.ts
- **Verification:** All 4 tests pass after fix
- **Committed in:** b3024ab (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking test mock hoisting issue)
**Impact on plan:** Fix was necessary for tests to execute. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `src/lib/actions/firm-actions.test.ts` (`Cannot find name 'const'` — 5 occurrences from Phase 1 Nyquist tests). These are out-of-scope per deviation rules and left unmodified. `tsc --noEmit` clean when excluding that file.

## Known Stubs

None — all components receive live data from `getFirmProfile` and the DB. No hardcoded empty arrays or placeholder text flowing to UI rendering.

## Threat Flags

None — all files created are within the scope declared in the plan's threat model. No new network endpoints, auth paths, or schema changes beyond what was planned.

## User Setup Required

None — no external service configuration required. All primitives already in package.json.

## Next Phase Readiness

- PROF-01/02/03/06 complete. Profile route is live at `/firms/[id]`.
- Plan 03-02 (Dashboard enhancements) can now add firm-name links to the comparison table pointing to `/firms/{id}`.
- `FirmRefreshAction` is reusable — can be imported for the comparison table Actions column in 03-02.
- Pre-existing `firm-actions.test.ts` TS errors should be investigated in a quick fix task before the phase closes.

---
*Phase: 03-dashboard-profiles*
*Completed: 2026-06-14*
