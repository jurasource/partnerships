# Phase 2: Research Engine - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the AI research loop: a worker that processes pending jobs by fetching structured UK data (already cached from Phase 1) plus Tavily web search results, synthesises per-(firm × topic) findings via an LLM, and writes every finding to the `findings` table with mandatory citations. The UI gains a research trigger button, visible job progress via polling, and a "last researched" timestamp + staleness badge per firm.

Phase 2 does NOT build firm profile pages, the comparison table filter/sort, or cross-cutting analysis — those are Phase 3 and 4.

</domain>

<decisions>
## Implementation Decisions

### Web Search Provider
- **D-01:** Tavily is the web search provider. Purpose-built for LLM research: returns clean snippets + source URLs citation-ready. Free tier (~1000 searches/month) comfortably covers 12 firms × 7 topics = ~168 searches per full run.
- **D-02:** Tavily is wrapped behind a thin `WebSearchClient` interface (a single file, e.g. `src/lib/search/types.ts`). The Tavily implementation lives in `src/lib/search/tavily.ts`. Swapping providers later is a config change, not a refactor.

### Research Job Architecture
- **D-03:** ~~The research worker runs via API Route fire-and-forget.~~ **Superseded by db-worker-upgrade (2026-06-14):** The `runResearch()` server action calls `enqueueJob()` (inserts a `jobs` DB row) then `researchQueue.add()` (pushes `{ firmId, jobId }` to Redis via BullMQ). A separate long-running process (`npm run worker` → `src/scripts/worker-process.ts`) consumes jobs from BullMQ (concurrency=2 by default) and calls `executeResearchJob()`. Status transitions (pending → running → done/failed) and per-topic `progressMessage` updates are written to the `jobs` DB table. The `/api/jobs` endpoint and `/jobs` page show live status via polling.
- **D-04:** The client polls `GET /api/research/status/[jobId]` every 2–3 seconds and updates a status badge (pending → running → done/failed). No SSE or streaming required for Phase 2.
- **D-05:** On partial failure (e.g. 3 of 7 topics done, then API error): mark the job `failed` with an error message, but keep the partial findings already written. User can re-trigger to fill the gaps. No rollback.

### Research Granularity & Progress
- **D-06:** One job per firm (topicId = null) — the worker runs all topics sequentially within a single job. Progress is shown as a "N/7 topics complete" counter, derived from the count of findings written for this firm since the job started (no extra column needed).
- **D-07:** Add a `lastResearchedAt` column to the `firms` table (Drizzle migration). Set it when a research job transitions to `done`. Staleness indicator shows a "Stale" badge when `lastResearchedAt` is more than 7 days ago or is null.

### Structured Data → AI Context
- **D-08:** The worker feeds cached structured data (Companies House profile + PSC data + procurement records from CF/FTS) as grounding context to the AI alongside Tavily search results. This means the AI can reference verified contract data directly rather than re-discovering it via web search. Relevant topics (e.g. "UK contracts held", "not UK-owned") benefit most; all topics receive at least a compact CH profile summary.
- **D-09:** All findings go into the same `findings` table (designed in Phase 1). The `confidence` column distinguishes provenance: HIGH = from structured UK API (CH / CF / FTS) as direct structured data summaries; MEDIUM = AI-derived with a cited Tavily source URL. LOW findings (AI-derived without verifiable source) must NOT be stored — the worker emits an explicit "not found" finding instead (RES-05).
- **D-10:** 1–2 Tavily searches per topic per firm. One focused query, one optional follow-up if results are thin. Keeps usage within the free tier and run time manageable.

### Citation Enforcement (from folded todo)
- **D-11:** Every finding stored in the `findings` table MUST have a non-empty `sourceUrl`, `sourceTitle`, and `rawSnippet`. The Zod `Finding` schema in the worker enforces this — no unsourced claim is ever stored. If the AI cannot produce a verifiable source for a topic, the worker writes a single finding with `summary = "Not found: <reason>"`, `confidence = "HIGH"`, and `sourceUrl = "not-found"` (a sentinel the UI renders as an explicit absence, not a missing row). This is enforced in code, not just by prompt.

### Folded Todos
- **"Enforce source citations on all research findings"** — Phase 2 is where citation enforcement is implemented in code. Zod schema on the Finding type requires all citation fields; worker rejects LOW confidence findings and writes "not found" instead. (Schema was designed in Phase 1; behavior is Phase 2's job.)
- **"View firm refresh results after data pull"** — Phase 2 adds progress visibility during and after research (job status polling, findings count). Full structured data display (procurement records, CH profile) will land in Phase 3 firm profiles. Phase 2 shows "N findings written" in the job status so the user knows something happened.
- **"Background worker / Railway note"** — Local-first: worker runs as a Next.js API Route. The fire-and-forget pattern (action enqueues + calls POST /api/research/run, no await) is intentionally Railway-extractable: the POST target moves from localhost to a Railway service URL, nothing else changes. Do not introduce synchronous coupling between the action and the research work.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Success Criteria
- `.planning/REQUIREMENTS.md` §Research Engine (RES-01 to RES-07) — all 7 requirements this phase must satisfy
- `.planning/ROADMAP.md` §Phase 2 — 4 success criteria that define "done"

### Phase 1 Schema & Job Queue Contract
- `src/db/schema.ts` — findings table (citation fields D-11), jobs table (status lifecycle D-08), firms table (lastResearchedAt to be added in D-07). Read before making any schema or query decisions.
- `src/lib/jobs/queue.ts` — enqueueJob / getJob / updateJobStatus — the contract Phase 2 worker builds on. Do not change this interface.
- `src/lib/actions/refresh-actions.ts` — existing server action pattern (enqueue → run → update status). Phase 2 extends this pattern.

### Stack & Architecture
- `CLAUDE.md` §Technology Stack — locked stack: Next.js 15/16 App Router, Drizzle/SQLite, Vercel AI SDK 5, Zod, shadcn/ui
- `.planning/research/STACK.md` — rationale for stack choices
- `.planning/research/ARCHITECTURE.md` — architectural patterns and data flow

### UK Structured Data Clients (Phase 1 — reused in Phase 2 as grounding context)
- `src/lib/clients/companies-house.ts` — CH profile + PSC (fed as context to AI)
- `src/lib/clients/contracts-finder.ts` — Contracts Finder results (already cached, fed as context)
- `src/lib/clients/find-a-tender.ts` — FTS results (already cached, fed as context)

### Phase 1 Context (prior decisions)
- `.planning/phases/01-data-foundation/01-CONTEXT.md` — all Phase 1 decisions, especially D-07 to D-11 which directly inform Phase 2

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/jobs/queue.ts` — `enqueueJob`, `getJob`, `updateJobStatus` ready for Phase 2 worker to call
- `src/lib/clients/companies-house.ts`, `contracts-finder.ts`, `find-a-tender.ts` — structured data clients; Phase 2 calls these to build the grounding context block fed to the AI
- `src/db/schema.ts` — `findings` table with all citation columns designed and ready to populate; `jobs` table with status enum

### Established Patterns
- Server action → job queue → status polling: established in Phase 1's `refreshFirm`. Phase 2 extends this with the real worker.
- `"server-only"` imports: retained on API route handlers and server actions. **Removed from `src/lib/` files** (db-worker-upgrade) — lib modules must be importable by the standalone worker process (`src/scripts/worker-process.ts`). These files are inherently server-side (Postgres, API keys) so the guard is not needed at the lib layer.
- Drizzle upsert (`onConflictDoNothing`): used for OCDS dedup; findings should use insert (re-research replaces old findings)

### Integration Points
- Phase 2 adds:
  - `POST /api/research/run` — new Route Handler that processes a job (reads firmId/jobId from body, runs research loop, updates job status)
  - `GET /api/research/status/[jobId]` — returns current job row for client polling
  - Drizzle migration to add `lastResearchedAt` to `firms` table
  - Research trigger UI: button in the Firms table row (existing `firms-table.tsx`) or the dashboard
- Phase 3 consumes: `findings` table and `lastResearchedAt` for firm profile pages and staleness badges

</code_context>

<specifics>
## Specific Ideas

- The "not found" sentinel finding (D-11) uses `summary = "Not found: <reason>"` and `sourceUrl = "not-found"` so Phase 3 UI can render it explicitly as an absence rather than a missing row — avoids silent gaps.
- Progress counter "N/7 topics complete" can be derived at read time: `SELECT COUNT(DISTINCT topic_id) FROM findings WHERE firm_id = ? AND created_at > job.started_at`. No extra column needed.
- The Tavily client wrapper should accept a `WebSearchQuery` and return `WebSearchResult[]` with `{ url, title, snippet }` — enough to populate `sourceUrl`, `sourceTitle`, `rawSnippet` on the Finding.
- The grounding context block fed to the AI should include a compact CH profile summary (status, SIC codes, incorporation country, PSC nationality) and the top 10 most recent procurement records (title, date, value, authority, source). Keep it concise so it doesn't crowd the Tavily results in the prompt.

</specifics>

<deferred>
## Deferred Ideas

- SSE / live streaming of research progress — polling covers RES-02 for v1. Streaming can be added in a later phase if the UX feels too coarse.
- Per-topic retry on partial failure — Phase 2 just keeps partial findings and lets the user re-trigger the whole firm. Per-topic retry logic is an optimisation for later.
- ~~Separate Railway worker process~~ — **DONE (db-worker-upgrade, 2026-06-14).** `src/scripts/worker-process.ts` is a long-running BullMQ worker (`npm run worker`). For Railway/cloud deployment, run this process as a separate service pointing at the same Postgres + Redis (managed).
- Configurable staleness threshold — 7 days is hardcoded for v1 (D-07). User-configurable threshold is a v2 feature.

</deferred>

---

*Phase: 2-Research Engine*
*Context gathered: 2026-06-14*
