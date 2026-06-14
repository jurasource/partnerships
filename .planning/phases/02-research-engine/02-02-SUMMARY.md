---
phase: 02-research-engine
plan: 02
subsystem: api
tags: [next-api-routes, server-actions, job-lifecycle, fire-and-forget, vitest, e2e-integration]

# Dependency graph
requires:
  - phase: 02-research-engine
    plan: 01
    provides: runResearchWorker, tavilyClient, findings/jobs/firms schema
  - phase: 01-data-foundation
    provides: enqueueJob, updateJobStatus, getJob, firms table, findings table

provides:
  - runResearch server action (fire-and-forget enqueue + trigger, src/lib/actions/research-actions.ts)
  - POST /api/research/run (worker route handler, src/app/api/research/run/route.ts)
  - GET /api/research/status/[jobId] (progress polling endpoint, src/app/api/research/status/[jobId]/route.ts)
  - E9 job-lifecycle integration test (src/app/api/research/run/route.test.ts)

affects:
  - 02-03 (Wave 3 — UI calls runResearch, polls GET /api/research/status/[jobId])

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js 16 App Router route handler (first route.ts files in the project)"
    - "Async params pattern: { params }: { params: Promise<{ jobId: string }> } — Next 16 requires await params"
    - "Fire-and-forget fetch with .catch(() => {}) at server action level (D-03)"
    - "Zod body validation in route handler before any DB mutation (T-02-06)"
    - "countDistinct(findings.topicId) for N/7 progress derived at read time (D-06)"
    - "vi.doMock + vi.resetModules per-test for true module isolation with in-memory SQLite"
    - "In-memory SQLite via raw CREATE TABLE SQL (no migration files required in tests)"

key-files:
  created:
    - src/lib/actions/research-actions.ts
    - src/app/api/research/run/route.ts
    - src/app/api/research/run/route.test.ts
    - src/app/api/research/status/[jobId]/route.ts
  modified: []

key-decisions:
  - "Next.js 16 params is a Promise: { params: Promise<{ jobId: string }> } — awaited in status route (plan said to check Next version)"
  - "countDistinct from drizzle-orm used for topicsComplete (not a subquery) — aligns with plan D-06 derivation"
  - "vi.resetModules() in beforeEach (not afterEach) for correct test isolation — ensures vi.doMock of @/db/client takes effect before import"
  - "In-memory SQLite with raw CREATE TABLE SQL for integration tests — avoids dependency on drizzle migration files which don't exist yet"
  - "vi.mock of next/server and next/cache required in test env — Next.js App Router built-ins unavailable in pure Node.js vitest environment"

requirements-completed: [RES-01, RES-02, RES-05, RES-06, RES-07]

# Metrics
duration: 20min
completed: 2026-06-14
---

# Phase 02 Plan 02: Research Engine Wire-Up Summary

**Triggerable, observable research backend: runResearch server action fires non-blocking POST to /api/research/run worker route (running → done/failed lifecycle), GET /api/research/status/[jobId] returns job row + N/7 topicsComplete progress count, E9 integration test proves terminal-state invariant and partial-findings retention.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-14T13:58:00Z
- **Completed:** 2026-06-14T14:04:00Z
- **Tasks:** 2 (Task 1 auto, Task 2 TDD)
- **Files created:** 4

## Accomplishments

- `runResearch` server action: `"use server"`, firm/CH-number guards, `enqueueJob`, fire-and-forget `fetch` to `/api/research/run` with `.catch(() => {})` — returns `{ ok, jobId }` immediately
- `POST /api/research/run`: `import "server-only"`, Zod body validation, `updateJobStatus(running)`, `await runResearchWorker(firmId, jobId, tavilyClient)`, job → done (+ `lastResearchedAt`, `revalidatePath`) or failed (partial findings retained, D-05)
- `GET /api/research/status/[jobId]`: `import "server-only"`, `await params` (Next 16), `getJob`, 404 on miss, `countDistinct(findings.topicId)` WHERE `firmId = job.firmId AND createdAt >= startedAt`, returns `{ ...job, topicsComplete, topicsTotal: 7 }`
- 3 E9 integration tests GREEN: partial-failure (3/7 findings retained, job→failed+errorMessage), happy-path (job→done, lastResearchedAt set), malformed body (400)
- All 87 tests across 9 test files pass — no regressions

## Task Commits

1. **Task 1: runResearch action + POST /api/research/run** — `00c0f6f` (feat)
2. **Task 2 RED: E9 lifecycle integrity test** — `55a7f8b` (test)
3. **Task 2 GREEN: GET /api/research/status/[jobId] endpoint** — `b411231` (feat)

## Files Created/Modified

- `src/lib/actions/research-actions.ts` — `"use server"` server action: firm lookup, CH guard, `enqueueJob`, fire-and-forget `fetch`, returns `{ ok, jobId }`
- `src/app/api/research/run/route.ts` — `import "server-only"` POST handler: Zod validate, job running→done/failed lifecycle, `lastResearchedAt` stamp, `revalidatePath`
- `src/app/api/research/run/route.test.ts` — 3 E9 integration tests: in-memory SQLite, vi.doMock, mocked ai/next/grounding/prompts
- `src/app/api/research/status/[jobId]/route.ts` — `import "server-only"` GET handler: `await params`, `getJob` → 404/200, `countDistinct` progress, `topicsTotal: 7`

## Decisions Made

- **Next.js 16 async params:** The `.next/types/validator.ts` confirms `params` is `Promise<ParamMap[Route]>` in Next 16. Status route uses `{ params: Promise<{ jobId: string }> }` with `await params` — matches the installed Next version.
- **countDistinct for progress:** Drizzle's `countDistinct(findings.topicId)` with `and(eq(findings.firmId, job.firmId), gte(findings.createdAt, job.startedAt))` implements the D-06 derivation exactly as specified.
- **vi.resetModules + vi.doMock in beforeEach:** Moving `vi.resetModules()` to `beforeEach` (before `vi.doMock`) is required for vitest to honour per-test DB injection via dynamic import. `afterEach` reset causes the second test to use a stale cached module.
- **In-memory SQLite with raw SQL:** No `drizzle/` migrations folder exists in the project yet. Raw `CREATE TABLE` SQL in tests avoids the `_journal.json` error while producing identical schema.
- **next/server mock in tests:** `NextRequest`/`NextResponse` from `next/server` cannot be used in pure Node.js vitest environment without a shim. A minimal `class NextResponse extends Response { static json() }` shim is sufficient for the test assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 16 params Promise type requires await**
- **Found during:** Task 2 (status route creation)
- **Issue:** Plan PATTERNS.md documented `{ params }: { params: { jobId: string } }` (Next 15 synchronous shape). In Next 16, `params` is `Promise<{ jobId: string }>` as confirmed by `.next/types/validator.ts`. Using the synchronous shape compiles but the `jobId` would be a Promise object at runtime.
- **Fix:** Changed to `{ params: Promise<{ jobId: string }> }` with `const { jobId } = await params` in the route handler.
- **Files modified:** `src/app/api/research/status/[jobId]/route.ts`
- **Verification:** `npx tsc --noEmit` — 0 new errors

**2. [Rule 3 - Blocking] next/server and next/cache not available in test environment**
- **Found during:** Task 2 (route.test.ts RED phase)
- **Issue:** `NextRequest`/`NextResponse` from `next/server` and `revalidatePath` from `next/cache` fail in vitest node environment — they require the Next.js runtime not available in pure Node tests.
- **Fix:** Added `vi.mock("next/server", ...)` with a minimal shim (`class NextResponse extends Response { static json() }`) and `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))` in the test file. Same pattern used by the plan's own worker.test.ts for `server-only`.
- **Files modified:** `src/app/api/research/run/route.test.ts`
- **Verification:** All 3 tests GREEN

**3. [Rule 3 - Blocking] Drizzle migrations folder absent — migrate() fails**
- **Found during:** Task 2 (route.test.ts RED phase, first iteration)
- **Issue:** Initial test used `migrate(testDb, { migrationsFolder: "./drizzle" })` but the `drizzle/` folder and `_journal.json` don't exist yet (db:push was used in Phase 1, not db:migrate).
- **Fix:** Replaced `migrate()` with inline `CREATE TABLE` raw SQL executed via `sqlite.exec()`. Tables match `schema.ts` exactly, tested via Drizzle queries.
- **Files modified:** `src/app/api/research/run/route.test.ts`
- **Verification:** All 3 tests GREEN

**4. [Rule 3 - Blocking] grounding.ts CH API calls fail in test environment**
- **Found during:** Task 2 (integration test run — happy path returning "failed" status)
- **Issue:** `runResearchWorker` calls `buildGroundingContext` which makes real HTTP requests to the Companies House API. Without `COMPANIES_HOUSE_API_KEY` in test env, the call throws and propagates, marking the job "failed" instead of "done" in the happy-path test.
- **Fix:** Added `vi.mock("@/lib/research/grounding", ...)` and `vi.mock("@/lib/research/prompts", ...)` in the test file to stub the grounding/prompt builders (same approach as `worker.test.ts`).
- **Files modified:** `src/app/api/research/run/route.test.ts`
- **Verification:** Happy-path test now correctly asserts `job.status === "done"` and `firm.lastResearchedAt !== null`

---

**Total deviations:** 4 auto-fixed (1 Rule 1 — Next 16 async params; 3 Rule 3 — blocking test environment issues)
**Impact on plan:** All deviations necessary for correctness and test runnability. No scope changes.

## Known Stubs

None — all data flows are wired end-to-end. The `topicsTotal: 7` hardcode is intentional (plan spec, can be derived from a topics COUNT query in a future plan if topic count becomes configurable).

## Threat Flags

No new threat surface beyond what the plan's threat model covers (T-02-05, T-02-06, T-02-07, T-02-08 — all mitigated as specified).

## Self-Check: PASSED

- FOUND: src/lib/actions/research-actions.ts
- FOUND: src/app/api/research/run/route.ts
- FOUND: src/app/api/research/run/route.test.ts
- FOUND: src/app/api/research/status/[jobId]/route.ts
- FOUND: .planning/phases/02-research-engine/02-02-SUMMARY.md
- FOUND commit: 00c0f6f (feat: runResearch action + POST /api/research/run)
- FOUND commit: 55a7f8b (test: E9 lifecycle test RED gate)
- FOUND commit: b411231 (feat: GET /api/research/status/[jobId])
- All 87 tests GREEN (npx vitest run)
- npx tsc --noEmit: 0 new errors (5 pre-existing in firm-actions.test.ts)

---
*Phase: 02-research-engine*
*Completed: 2026-06-14*
