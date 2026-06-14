---
created: 2026-06-14T12:17:11.803Z
title: API call tracking dashboard
area: ui
files:
  - src/lib/clients/companies-house.ts
  - src/lib/clients/contracts-finder.ts
  - src/lib/clients/find-a-tender.ts
  - src/lib/search/tavily.ts
  - src/db/schema.ts
---

## Problem

The dashboard makes calls to multiple external APIs (Companies House, Contracts Finder, Find a Tender, Tavily web search). There is currently no visibility into:
- Which firms/tasks are triggering which API calls
- How many requests have been made and when
- Whether we're approaching rate limits (CH: ~600 req/5min; Tavily: ~1000 searches/month free tier)

Without this, it's easy to silently hit rate limits or not know which research jobs are the most API-intensive.

## Solution

Two parts:

1. **Tracking layer** — Log every outbound API call to a new `api_calls` table (or similar) in SQLite. Each record: `provider` (companies-house | contracts-finder | find-a-tender | tavily), `endpoint`, `firmId` (nullable), `jobId` (nullable), `requestedAt`, `statusCode`, `latencyMs`. This can be done by instrumenting the existing clients in `src/lib/clients/` and `src/lib/search/tavily.ts` — a thin wrapper around each `fetch` call that writes the record after the response.

2. **UI section** — A dedicated panel or tab in the dashboard (e.g. "API Usage" in a settings/admin area or as a sidebar widget) showing:
   - Per-provider request counts today / this month
   - Last request timestamp per provider
   - Rate limit headroom (e.g. "Tavily: 234/1000 searches used this month")
   - Recent call log table: provider, endpoint, firm, timestamp, status

Phase placement: Likely Phase 4 (Dashboard & Filtering) or a standalone sub-phase after Phase 2 (Research Engine) since the tracking layer should instrument the clients that Phase 2 builds.
