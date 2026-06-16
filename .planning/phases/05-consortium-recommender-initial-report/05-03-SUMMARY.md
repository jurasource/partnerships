---
phase: 05-consortium-recommender-initial-report
plan: "03"
subsystem: report
tags:
  - report
  - rsc
  - vitest
  - integration-test
  - snapshot
dependency_graph:
  requires:
    - 05-01 (scoreAndRankCombinations, RecommendResponseSchema)
    - 05-02 (RecommendationResult with readOnly prop)
    - 01-01 (firms, DB client)
    - 04-02 (conflictPairs, partnershipPairs, ownershipRecords, riskFlags)
    - 04-01 (procurementRecords)
  provides:
    - /report server-rendered page (RSC, read-only 1+1+1 consortium)
    - E9 seeded 12x7 integration test + golden snapshot
    - Phase 5 acceptance gate: human sign-off on /report pending
  affects:
    - ROADMAP Phase 5 success criterion #5 (E9 acceptance gate — human verification in Task 4)
    - CONS-01 through CONS-05 all delivered and proven end-to-end
tech_stack:
  added: []
  patterns:
    - force-dynamic RSC with direct scorer import (no HTTP round-trip)
    - RecommendResponseSchema.parse() validates scorer output before rendering
    - Dynamic imports in Vitest to guard DB-dependent suite when DATABASE_URL absent
    - afterAll sql.end() to close postgres.js pool cleanly after integration test
key_files:
  created:
    - src/app/(app)/report/page.tsx
    - src/lib/recommend/__tests__/seeded-e2e.test.ts
    - src/lib/recommend/__tests__/__snapshots__/seeded-e2e.test.ts.snap
  modified:
    - PENDING_RELEASE.md
    - RELEASE_NOTES.md
decisions:
  - "RecommendResponseSchema.parse(result) used to cast ScorerResult to RecommendResponse before passing to RecommendationResult — ScorerResult is a plain interface (not Zod-inferred discriminated union) so it is not type-compatible with RecommendResponse without validation"
  - "E9 test uses top-level await dynamic imports conditioned on DB_AVAILABLE=Boolean(process.env.DATABASE_URL) — prevents @/db/client module evaluation (which throws on missing DATABASE_URL) without requiring any special CI configuration"
  - "Snapshot normalized to strip volatile fields: firmId replaced with firmName, ownershipRecord reduced to {ukIncorporated, countryOfOwnership}, signal scores rounded to 2dp"
  - "afterAll sql.end() closes the postgres.js connection pool so Vitest can exit cleanly after the integration test"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-16"
  tasks_completed: 3
  files_changed: 5
  tests_added: 1
---

# Phase 05 Plan 03: /report Page + E9 Integration Test Summary

**One-liner:** Force-dynamic RSC /report page calling scorer directly (no HTTP fetch), read-only RecommendationResult, with E9 seeded 12x7 integration test + committed golden snapshot as regression tripwire.

## What Was Built

### Task 1: /report server page

**src/app/(app)/report/page.tsx** — async RSC with `export const dynamic = "force-dynamic"`:
- Loads all six tables in a single `Promise.all` of `db.select().from(...)` (read-only — no db.insert/update/delete)
- Calls `scoreAndRankCombinations` directly via `import "@/lib/recommend/scorer"` (no HTTP fetch to /api/recommend per RESEARCH.md §Q2)
- Validates output via `RecommendResponseSchema.parse(result)` before rendering (T-05-10 mitigation)
- Default mix: `{ Consultancy: 1, Infrastructure: 1, Nuclear: 1 }`, equal 25 weights, `lockedFirmIds: []`
- Renders `<RecommendationResult response={validatedResult} readOnly />` — readOnly=true suppresses weight sliders, lock section, recompute button, Reset link (D-11)
- Two explicit no-data states (firms table empty OR scorer returns no_valid_team): heading "No report available", body directing user to Dashboard to trigger research — exact UI-SPEC copy

### Task 2: E9 seeded 12x7 integration test + golden snapshot

**src/lib/recommend/__tests__/seeded-e2e.test.ts** — integration test connecting to real seeded Postgres:
- Guards gracefully when DATABASE_URL absent: dynamic imports conditioned on `Boolean(process.env.DATABASE_URL)` — test skips rather than hard-fails CI on machines without a DB
- When seeded: asserts `firms.length >= 12`, `result.status === "ok"`, `RecommendResponseSchema.parse` does not throw
- Asserts primary recommendation covers all three capability tags (Consultancy/Infrastructure/Nuclear)
- Asserts every recommended firm has `signalScores` (4 fields, E6) and `ownershipRecord` present (E2/E6)
- `toMatchSnapshot()` on normalized result (firmName + sorted capabilityTags + 2dp signal scores + {ukIncorporated, countryOfOwnership} — volatile fields stripped)
- `afterAll` closes postgres.js pool for clean Vitest exit

**Golden snapshot** (`seeded-e2e.test.ts.snap`) — committed; primary recommendation:
- Rank 1: BARINGA PARTNERS LLP (Consultancy) + AtkinsRéalis (Infrastructure/Nuclear) + Frazer Nash (Infrastructure/Nuclear)
- Rank 2: CAVENDISH NUCLEAR LIMITED + BARINGA PARTNERS LLP + AMENTUM INTERNATIONAL HOLDINGS UK LTD.
- Rank 3: Laing O'Rourke + AtkinsRéalis + Frazer Nash
- All three recommendations have `hasPriorPartnerships: true` (seeded data contains partnership records)

**Release docs updated:**
- `PENDING_RELEASE.md`: Phase 5 /report + E9 section added with Dev step to run DB up/seed before E9
- `RELEASE_NOTES.md`: 2026-06-16 bullet added for /report + E9

### Task 3: Full suite green (commit gate)

`npm test` exits 0 with all 21 test files and 198 tests passing. The E9 test skips gracefully without DATABASE_URL (the correct behavior for `npm test` run without a DB). Running `DATABASE_URL=... npx vitest run src/lib/recommend/__tests__/seeded-e2e.test.ts` with the seeded Postgres confirms the snapshot passes.

### Task 4 (Checkpoint — pending)

E9 acceptance gate: human sign-off on the rendered /report page. Task 4 is a `checkpoint:human-verify` with `gate="blocking-human"` — execution paused here, awaiting human verification in the browser.

## Verification Results

```
npx tsc --noEmit (report page)
  no type errors referencing report page

npm test (full suite, without DATABASE_URL)
  Test Files  21 passed (21)
  Tests  198 passed (198)

DATABASE_URL=... npx vitest run src/lib/recommend/__tests__/seeded-e2e.test.ts
  Test Files  1 passed (1)
  Tests  1 passed (1)
  Snapshots  1 written → confirmed stable on re-run
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ScorerResult not assignable to RecommendResponse**
- **Found during:** Task 1 TypeScript check
- **Issue:** `scoreAndRankCombinations` returns `ScorerResult` (a plain interface), but `RecommendationResult` expects `RecommendResponse` (a Zod-inferred discriminated union). TypeScript emits TS2322 because `ScorerResult.status` is `"ok" | "no_valid_team"` (not narrowed) while `RecommendResponse` is a discriminated union where each branch has a literal `status`.
- **Fix:** Added `import { RecommendResponseSchema }` and called `RecommendResponseSchema.parse(result)` to produce a properly-typed `RecommendResponse` before passing to the component. This also serves as the T-05-10 threat mitigation (contract violation fails fast).
- **Files modified:** `src/app/(app)/report/page.tsx`
- **Commit:** 2c2a361

**2. [Rule 1 - Bug] DATABASE_URL guard: @/db/client throws at module evaluation time**
- **Found during:** Task 2 — running the E9 test with `npm test` (no DATABASE_URL)
- **Issue:** `src/db/client.ts` throws `Error: DATABASE_URL environment variable is not set` at module evaluation time. A top-level `import { db } from "@/db/client"` causes the entire test file to fail at import, not at test runtime — the graceful skip logic inside the test body is never reached.
- **Fix:** Replaced static top-level imports with top-level `await` dynamic imports conditioned on `DB_AVAILABLE = Boolean(process.env.DATABASE_URL)`. When DATABASE_URL is absent, `@/db/client` is never imported and the test skips with a console.warn message. The suite degrades gracefully without hard-failing.
- **Files modified:** `src/lib/recommend/__tests__/seeded-e2e.test.ts`
- **Commit:** b1250a9

## Known Stubs

None — `/report` renders live data from the seeded Postgres via the deterministic scorer. The no-data state is explicit and intentional (not a stub — it correctly handles the empty-DB case). The golden snapshot reflects real seeded data.

## Threat Flags

All STRIDE threats in the plan threat model are mitigated:
- T-05-10 (contract violation): `RecommendResponseSchema.parse(result)` throws before any rendering if the scorer output breaks the schema contract
- T-05-11 (tampering — DB writes): report/page.tsx contains only `db.select().from(...)` calls; zero `db.insert`/`db.update`/`db.delete` (confirmed by grep and acceptance criteria)
- T-05-12 (stale data — accepted): report renders current DB state at render time (force-dynamic); staleness surfaced via existing staleness-badge pattern on firm profiles

No new threat surface introduced.

## Self-Check: PASSED

Files exist:
- src/app/(app)/report/page.tsx: FOUND
- src/lib/recommend/__tests__/seeded-e2e.test.ts: FOUND
- src/lib/recommend/__tests__/__snapshots__/seeded-e2e.test.ts.snap: FOUND

Commits exist:
- 2c2a361 feat(05-03): /report server page — direct scorer import, read-only result: FOUND
- b1250a9 feat(05-03): E9 seeded 12x7 integration test + golden snapshot + release docs: FOUND
