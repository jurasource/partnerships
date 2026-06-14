---
created: 2026-06-14T08:55:59Z
title: Background worker on Railway for hosted Vercel deployment
area: general
files:
  - src/lib/jobs/queue.ts
  - src/lib/actions/refresh-actions.ts
---

## Problem

Vercel terminates long-running requests (60s max on Pro, 10s on Hobby). The per-firm refresh flow — hitting Companies House, Contracts Finder, and Find a Tender, then writing procurement records — can take well over 60s for a full refresh of all 12 firms. This means the current `refreshFirm` server action will time out on Vercel in production.

## Solution

When moving to a hosted deployment, run the background job worker on Railway instead of Vercel. Architecture:

- **Vercel**: serves the Next.js frontend + API routes; the "refresh" action only enqueues a job in SQLite (already implemented in `queue.ts`) and returns immediately
- **Railway**: runs a long-lived Node.js worker process that polls the SQLite job queue (or a Postgres queue on cloud) and executes the actual research work

For cloud deployment, SQLite must be replaced with Postgres (Drizzle dialect swap, already planned) so both Vercel and Railway can access the same DB. The job-queue skeleton in `src/lib/jobs/queue.ts` is already designed for this — the enqueue/claim/status contract is worker-agnostic.

Decision: Railway is the chosen platform for the background worker service.
