---
created: 2026-06-15T11:50:18.081Z
title: Delete old jobs and fix startedAt to datetime
area: database
files:
  - src/db/schema.ts
  - src/app/jobs/page.tsx
---

## Problem

Two issues with the `jobs` table:

1. **No way to delete jobs**: The `/jobs` page shows all historical job records but provides no way to clean them up. Old completed/failed jobs accumulate indefinitely.

2. **`startedAt` and `completedAt` are text columns**: In `src/db/schema.ts`, `startedAt: text("started_at")` and `completedAt: text("completed_at")` are stored as plain text rather than proper Postgres `timestamp` columns. This prevents correct ordering, duration calculations, and date comparisons at the DB level.

## Solution

1. Add a delete action on the `/jobs` page — either per-row delete buttons or a "Clear completed jobs" bulk action.
2. Migrate `started_at` and `completed_at` columns from `text` to `timestamp` in the Drizzle schema, with a corresponding Drizzle migration. (`created_at` is already a `timestamp` — make these consistent.)
