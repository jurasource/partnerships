---
phase: 04-cross-cutting-analysis
plan: "02"
subsystem: cross-cutting-extraction
tags: [cross-cutting, bullmq, co-supplier, conflicts, collaboration, extraction, unit-tests, job-queue]
dependency_graph:
  requires: [04-01]
  provides: [detectCoSuppliers, extractConflicts, extractCollaboration, executeCrossCuttingJob, crossCuttingQueue, cross-cutting-worker]
  affects: [04-03, 04-04]
tech_stack:
  added: []
  patterns: [two-query-merge, canonical-pair-ordering, fabricated-name-rejection, onConflictDoUpdate-upsert, bullmq-second-queue, try-catch-done-or-failed]
key_files:
  created:
    - src/lib/cross-cutting/co-supplier.ts
    - src/lib/cross-cutting/conflicts.ts
    - src/lib/cross-cutting/collaboration.ts
    - src/lib/cross-cutting/runner.ts
    - src/lib/jobs/__tests__/cross-cutting-enqueue.test.ts
    - src/lib/cross-cutting/__tests__/co-supplier.test.ts
    - src/lib/cross-cutting/__tests__/conflicts.test.ts
  modified:
    - src/lib/cross-cutting/schemas.ts
    - src/lib/jobs/bull.ts
    - src/lib/jobs/queue.ts
    - src/lib/jobs/runner.ts
    - src/scripts/worker-process.ts
decisions:
  - "[04-02] Two-query merge for co-supplier detection (same pattern as comparison-rows.ts): select firm's ocids, then select all records for those ocids, group in JS — avoids Drizzle subquery complexity"
  - "[04-02] resolveFirmName loads all firms from DB once per call and iterates in JS — acceptable for the small firms table (<50 rows); avoids multiple DB round-trips per conflict"
  - "[04-02] extractConflicts reads both 'Partnerships and JVs' AND 'Reputation and controversy' findings (the plan's critical correction: no 'conflicts between firms' topic exists)"
  - "[04-02] collaboration.ts always writes a collaboration_records row even when no finding exists (explicit empty-state pattern — Pitfall 4)"
  - "[04-02] cross-cutting enqueue path fix: import is '../runner' from jobs/__tests__/, not '../../runner'"
metrics:
  duration: "18 min"
  completed: "2026-06-15"
  tasks_completed: 2
  files_modified: 12
  tests_added: 17
---

# Phase 04 Plan 02: Conflict/Partnership Extraction + Cross-Cutting Job Pipeline Summary

**One-liner:** Co-supplier SQL detection, conflict/collaboration LLM extraction with fabricated-name rejection, executeCrossCuttingJob orchestrator running all five passes, and BullMQ cross-cutting queue auto-enqueued after research completion with 31 passing unit tests.

## What Was Built

### Task 1: Co-supplier Detection + Conflict/Collaboration LLM Extraction (TDD)

- **src/lib/cross-cutting/schemas.ts** (extended): Added `ConflictsExtractionSchema` (array of conflict pair items with otherFirmName, conflictType enum "audit"|"competitor", evidenceSummary, sourceUrl, sourceTitle, rawSnippet); `JVPartnershipsExtractionSchema` (array of explicitly announced JV partnerships); `CollaborationExtractionSchema` (culture-fit summary + citation fields). All fields have `.describe()` text guiding extraction and enforcing empty-array-not-fabrication discipline.

- **src/lib/cross-cutting/co-supplier.ts**: `detectCoSuppliers(firmId)` implements the two-query merge pattern: (1) select all procurement_records for the target firm to get their ocids, (2) select all records with those ocids, group in JS. For each ocid with counterpart firms, inserts a partnership_pairs row with partnershipType "co-supplier", sourceType "ocds", sourceUrl = ocid. Canonical ordering via `canonicalPair()` and `onConflictDoUpdate` on the unique index ensures idempotency.

- **src/lib/cross-cutting/conflicts.ts**: Exports `extractConflicts(firmId)`, `canonicalPair(id1, id2)`, and `resolveFirmName(name)`. `extractConflicts` reads both "Partnerships and JVs" and "Reputation and controversy" findings; for each present finding runs `generateText` with `ConflictsExtractionSchema`; resolves each extracted firm name against `firms.canonicalName` and parsed `aliases` JSON; discards unresolvable names (T-04-04 fabricated-name rejection, Pitfall 3); enforces canonical pair ordering (T-04-05); upserts via `onConflictDoUpdate` on `(firmAId, firmBId, conflictType)`.

- **src/lib/cross-cutting/collaboration.ts**: `extractCollaboration(firmId)` reads the "Partnerships and JVs" finding; always writes one `collaboration_records` row (explicit empty-state with sourceUrl "not-found" when no finding exists — Pitfall 4); runs two LLM passes: (1) `CollaborationExtractionSchema` for culture-fit summary, (2) `JVPartnershipsExtractionSchema` for explicitly announced JV partnerships. JV pairs are resolved via `resolveFirmName`, canonicalized, and upserted as partnership_pairs with partnershipType "jv".

- **Tests (14 passing)**:
  - co-supplier.test.ts (5 tests): shared ocid produces canonical pair, canonical ordering, idempotency via onConflictDoUpdate, no pairs when no shared ocids, canonical ordering regardless of which firm triggers detection
  - conflicts.test.ts (9 tests): real firm stored + fabricated firm discarded, canonical ordering enforced, onConflictDoUpdate used, empty extraction stores nothing, no throw when findings absent, alias resolution, canonicalPair helper ordering (3 cases)

### Task 2: Cross-Cutting Job Orchestrator + BullMQ Queue + Enqueue Trigger + Worker Wiring

- **src/lib/jobs/bull.ts** (extended): Added `CROSS_CUTTING_QUEUE_NAME = "cross-cutting-analysis"`, `CrossCuttingJobPayload = { firmId: string; jobId: string }`, and `crossCuttingQueue = new Queue<CrossCuttingJobPayload>(...)` reusing the existing `connection` object with the same defaultJobOptions as the research queue.

- **src/lib/jobs/queue.ts** (extended): `EnqueueJobInput` gains optional `jobType?: "research" | "cross-cutting-analysis"`; `enqueueJob` writes `jobType: input.jobType ?? "research"` to the DB row.

- **src/lib/cross-cutting/runner.ts**: `executeCrossCuttingJob(firmId, jobId)` follows the executeResearchJob lifecycle: `getJob` (throws on not-found or firm mismatch), `updateJobStatus running`, try: progress + extractOwnership → extractRiskFlags → detectCoSuppliers → extractConflicts → extractCollaboration → `updateJobStatus done`; catch: `updateJobStatus failed` with error message. Never leaves a job stuck in "running" (T-04-07).

- **src/lib/jobs/runner.ts** (extended): After the research "done" status update and `lastResearchedAt` update (inside try block, not in catch), adds `enqueueJob({ firmId, jobType: "cross-cutting-analysis" })` then `crossCuttingQueue.add("cross-cutting", { firmId, jobId: ccJobId })`. Cross-cutting job only enqueued on research success.

- **src/scripts/worker-process.ts** (extended): Imports `executeCrossCuttingJob` and `CROSS_CUTTING_QUEUE_NAME`/`CrossCuttingJobPayload`; creates `crossCuttingWorker = new Worker<CrossCuttingJobPayload>(...)` with matching concurrency; replicates completed/failed/error event listeners; extends `shutdown()` to `await crossCuttingWorker.close()`.

- **Tests (3 passing)**:
  - cross-cutting-enqueue.test.ts: enqueue called with jobType "cross-cutting-analysis" after success; "done" status update precedes enqueue; crossCuttingQueue.add NOT called when research worker throws

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrong relative import path in enqueue test**
- **Found during:** Task 2 test run
- **Issue:** `import("../../runner")` from `src/lib/jobs/__tests__/` resolves to `src/lib/runner` (non-existent); correct path is `import("../runner")`
- **Fix:** Changed to `../runner`
- **Files modified:** src/lib/jobs/__tests__/cross-cutting-enqueue.test.ts
- **Commit:** path fixed in same task commit

**2. [Rule 1 - Bug] TS2352 type cast in override tests needed `unknown` intermediary**
- **Found during:** Task 1 TypeScript check
- **Issue:** `db as { select: ReturnType<typeof vi.fn> }` required `as unknown as { ... }` since the real db type doesn't sufficiently overlap with the mock shape
- **Fix:** Added `unknown` intermediary cast in co-supplier.test.ts and conflicts.test.ts
- **Files modified:** src/lib/cross-cutting/__tests__/co-supplier.test.ts, src/lib/cross-cutting/__tests__/conflicts.test.ts
- **Commit:** 1b78c59

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-04-04 | resolveFirmName validates extracted names against firms.canonicalName and aliases JSON; unresolved names discarded before insert — no fabricated firm can reach conflict_pairs or partnership_pairs |
| T-04-05 | canonicalPair enforces firmAId < firmBId lexicographically in conflicts.ts and co-supplier.ts; unique index deduplicates across both firms' extraction runs |
| T-04-06 | Drizzle eq/inArray parameterised queries only in co-supplier.ts — no string-interpolated SQL |
| T-04-07 | executeCrossCuttingJob try/catch always transitions to done or failed; individual extractors handle missing findings without throwing |

## Known Stubs

None. All implementation writes real DB rows. No placeholder data.

## Threat Flags

None. No new network endpoints introduced. All new surface is internal DB writes via Drizzle (parameterised queries) and BullMQ Redis queue (firmId/jobId payload).

## Self-Check: PASSED
