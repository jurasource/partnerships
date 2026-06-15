---
slug: refactor-ch-refresh-job
date: 2026-06-15
status: in-progress
---

# Refactor: CH Refresh as Dedicated BullMQ Job

Move "UK INCORPORATED" and ownership field population out of cross-cutting analysis into a standalone `ch-refresh` BullMQ job. The job is triggerable from the jobs page, firm profile page, and firms page, and is also auto-enqueued when a research job completes.

## Tasks

- [ ] 1. Add `"ch-refresh"` to jobType in schema.ts and queue.ts
- [ ] 2. Add `chRefreshQueue` to bull.ts
- [ ] 3. Create `src/lib/cross-cutting/ch-refresh-runner.ts` (executeCHRefreshJob)
- [ ] 4. Remove extractOwnership (Step 1) from cross-cutting/runner.ts, renumber to 4 steps
- [ ] 5. Auto-enqueue ch-refresh job in jobs/runner.ts after research success
- [ ] 6. Add CH refresh worker to worker-process.ts
- [ ] 7. Add `runCHRefreshJob` action to research-actions.ts; update BatchJobType + runBatchJobs; remove `refreshCHData`
- [ ] 8. Update firm-ch-refresh.tsx to use queued job with polling
- [ ] 9. Create firm-row-ch-refresh.tsx (icon-only, for firms table)
- [ ] 10. Add FirmRowCHRefresh to firms-table.tsx FirmRowActions
- [ ] 11. Update jobs/page.tsx for "ch-refresh" job type
- [ ] 12. Add "CH Refresh" option to batch-job-submit.tsx

## Files Changed

- src/db/schema.ts
- src/lib/jobs/queue.ts
- src/lib/jobs/bull.ts
- src/lib/cross-cutting/ch-refresh-runner.ts (NEW)
- src/lib/cross-cutting/runner.ts
- src/lib/jobs/runner.ts
- src/scripts/worker-process.ts
- src/lib/actions/research-actions.ts
- src/components/firms/firm-ch-refresh.tsx
- src/components/firms/firm-row-ch-refresh.tsx (NEW)
- src/components/firms/firms-table.tsx
- src/app/(app)/jobs/page.tsx
- src/components/jobs/batch-job-submit.tsx
