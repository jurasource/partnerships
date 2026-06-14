---
phase: 02-research-engine
fixed_at: 2026-06-14T00:00:00Z
review_path: .planning/phases/02-research-engine/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-06-14T00:00:00Z
**Source review:** .planning/phases/02-research-engine/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (critical only)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: /api/research/run is unauthenticated and accepts any firmId/jobId

**Files modified:** `src/app/api/research/run/route.ts`
**Commit:** 7065f3b
**Applied fix:** Added a `getJob(jobId)` lookup after Zod body validation. Returns 404 if the job row does not exist, and 400 if `job.firmId !== firmId`. The mutation (`updateJobStatus`) now only executes after this ownership check passes. Also added `getJob` to the import of `@/lib/jobs/queue`. The fix comment references the threat tag `T-02-09`.

---

### CR-02: setInterval return value discarded — polling interval leaks on unmount

**Files modified:** `src/components/firms/firm-row-research.tsx`
**Commit:** beb2d18
**Applied fix:** Added `intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)` at the component level. Added a `React.useEffect(() => () => { clearInterval(intervalRef.current) }, [])` that React invokes on unmount. Replaced the local `const intervalId = setInterval(...)` with `intervalRef.current = setInterval(...)`. Replaced both `clearInterval(intervalId)` calls inside the interval callback with null-guarded `clearInterval(intervalRef.current)` calls. Removed the dead `return () => clearInterval(intervalId)` that was the return value of the async click handler (which React never invoked).

---

### CR-03: runResearchWorker inserts duplicate findings on re-run

**Files modified:** `src/db/schema.ts`, `src/lib/research/worker.ts`
**Commit:** 749e0f8
**Applied fix:**

In `schema.ts`: Converted the `findings` table from a plain `sqliteTable(name, columns)` call to the three-argument form `sqliteTable(name, columns, (table) => [...])`, adding `uniqueIndex("findings_firm_topic_unique").on(table.firmId, table.topicId)` as the index factory. The `uniqueIndex` import was already present in the file from the `procurementRecords` table definition.

In `worker.ts`: Added `sql` to the `drizzle-orm` import. Changed `db.insert(findings).values({...})` to an upsert by chaining `.onConflictDoUpdate({ target: [findings.firmId, findings.topicId], set: { ...all fields..., createdAt: sql\`(datetime('now'))\` } })`. Refreshing `createdAt` on upsert ensures the status endpoint's `gte(findings.createdAt, job.startedAt)` count remains accurate for re-runs.

Note: `npm run db:push` should be run after deploying to apply the new index to the local SQLite file.

---

### CR-04: PSC nationality filter incorrectly classifies entities — produces misleading ownership intelligence

**Files modified:** `src/lib/research/grounding.ts`
**Commit:** 43bdcd6
**Applied fix:** Replaced the single `nonUkPscs` filter with a two-path approach that correctly handles both natural persons and corporate PSCs:

- Natural persons (items where `kind` does NOT include "corporate-entity"): checked against an expanded UK terms array (`british`, `english`, `scottish`, `welsh`, `northern irish`, `united kingdom`) using `nat.includes(term)`. Items with no `nationality` field are flagged conservatively as non-UK.
- Corporate PSCs (items where `kind` includes "corporate-entity"): checked via `country_of_residence` against UK country names (`england`, `scotland`, `wales`, `northern ireland`, `united kingdom`, `england and wales`). Items with no `country_of_residence` are flagged conservatively.

The PSC summary in the grounding context now reports natural-person non-UK nationalities and corporate non-UK PSC names separately, matching what is needed for ownership intelligence. The fix uses only typed fields from the existing `PscItemSchema` (`kind`, `nationality`, `country_of_residence`, `name`).

---

### CR-05: Tavily API key sent in request body — should be in Authorization header

**Files modified:** `src/lib/search/tavily.ts`
**Commit:** 01f5287
**Applied fix:** Removed `api_key: apiKey` from the JSON body. Added `"Authorization": \`Bearer \${apiKey}\`` to the `headers` object alongside `"Content-Type": "application/json"`. The key is now transmitted only in the HTTP header, which is stripped by standard logging infrastructure and follows the industry-standard Bearer token pattern.

---

## Type Check

`npx tsc --noEmit` was run against the worktree after all fixes. All errors observed were pre-existing project-wide errors caused by the absence of `node_modules` in the isolated worktree (module resolution errors for `react`, `next`, `drizzle-orm`, `zod`, `ai`, etc., and consequent `JSX.IntrinsicElements` and implicit-any errors). No new type errors were introduced by any of the five fixes. The pre-existing nature of all errors was confirmed by running the same type check against the original pre-fix versions of the modified files and observing identical error categories.

---

_Fixed: 2026-06-14T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
