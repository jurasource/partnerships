---
created: 2026-06-14T16:29:54.449Z
title: Bulk refresh all firms with staleness threshold
area: api
files:
  - src/lib/actions/research-actions.ts
  - src/components/dashboard/comparison-table.tsx
  - src/app/page.tsx
---

## Problem

Currently research refresh is per-firm only (one button per row in the comparison table). Users need two additional capabilities:
1. **Refresh all firms at once** — trigger research for all firms in a single action. Jobs may run sequentially (to avoid rate-limiting the search/LLM APIs) or in parallel — this should be a configurable option.
2. **Stale-only refresh** — "refresh any firm whose research is older than X days" — user specifies a staleness threshold (e.g. 7 days) and only firms exceeding it get queued.

## Solution

- Add a `runResearchBulk({ firmIds, sequential?: boolean })` server action (or extend `runResearch` to accept an array) in `src/lib/actions/research-actions.ts`.
- Add a "Refresh All" button to the comparison dashboard (`src/app/page.tsx` or a new toolbar component).
- Add a "Refresh stale (>N days)" control — either a dropdown preset or a number input — that filters firms by `lastResearchedAt` before passing IDs to the bulk action.
- Sequential mode: iterate firmIds one by one with `await`; parallel mode: `Promise.all`. Expose this as a UI toggle or config setting.
- Job status polling already exists (Phase 2 `02-02-PLAN.md`) — bulk refresh should reuse the same polling mechanism, showing aggregate progress (e.g. "3/12 complete").
