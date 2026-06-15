---
slug: refactor-ch-refresh-job
date: 2026-06-15
status: complete
---

# Summary: CH Refresh as Dedicated BullMQ Job

All 11 tasks completed. 159/159 tests passing.

## What Changed

- New `"ch-refresh"` job type throughout the stack (schema, queue types, bull.ts queue)
- New `ch-refresh-runner.ts` executor: calls `extractOwnership()` which fetches CH snapshot + derives ownership fields
- Cross-cutting analysis drops Step 1 (extractOwnership) — now 4 steps instead of 5
- Research job auto-enqueues BOTH cross-cutting AND ch-refresh on success
- New `chRefreshWorker` in worker-process.ts
- `runCHRefreshJob(firmId)` server action replaces old inline `refreshCHData`
- `FirmCHRefresh` now queues the job and polls job status (no longer inline)
- New `FirmRowCHRefresh` icon-only button in firms table row actions
- Jobs page handles "ch-refresh" type: displays "CH Refresh" label
- Batch submit adds "CH Refresh" option (eligibility: CH number required)
- Test mock for `@/lib/jobs/bull` updated to include `chRefreshQueue`
