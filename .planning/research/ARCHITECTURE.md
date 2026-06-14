# Architecture Patterns

**Domain:** AI-assisted firm intelligence research + filterable dashboard
**Researched:** 2026-06-13
**Updated:** 2026-06-14 (db-worker-upgrade branch — Postgres + Redis/BullMQ worker)
**Confidence:** HIGH (component model, data flow, job pattern), MEDIUM (exact analysis-layer boundary)

## Context Recap

Single-user, local-first Next.js 15 full-stack app (per STACK.md): Postgres/Drizzle database, Redis-backed BullMQ job queue, Vercel AI SDK tool-calling research loop, thin `fetch`+Zod clients for three UK public APIs (Companies House, Find a Tender, Contracts Finder) plus a web-search tool (Tavily). Research is long-running (minutes per firm), cached, and manually refreshed per firm. Output is an interactive, filterable dashboard with cross-cutting analysis (ownership, conflicts, partnerships, consortium recommendations, risk flags).

The defining architectural problem is **a slow, multi-source research pipeline feeding a fast, structured read model.** Everything below follows from separating those two concerns: write-side (research jobs) and read-side (dashboard).

## Recommended Architecture

```
                          ┌─────────────────────────────────────────────┐
                          │              DASHBOARD (read-side)            │
                          │  RSC pages + TanStack Table/Query + Recharts  │
                          │  filter by tag, firm profiles, cross-cutting  │
                          │  views, consortium recommender, risk flags    │
                          └───────────────▲──────────────┬────────────────┘
                                          │ read findings │ trigger refresh
                                          │ (RSC query)    │ poll job status
                          ┌───────────────┴──────────────▼────────────────┐
                          │           POSTGRES DATABASE (source of truth)    │
                          │  firms · topics · findings · raw_payloads ·     │
                          │  research_jobs · firm_relationships             │
                          └───────────────▲──────────────┬────────────────┘
                                  write    │              │ enqueue job
                          findings + raw   │              │ (jobId)
                          ┌───────────────┴──────────────▼────────────────┐
                          │        RESEARCH ORCHESTRATOR (write-side)       │
                          │  job worker → per (firm × topic) research loop  │
                          │  AI SDK tool-calling agent, structured output   │
                          └──┬─────────────┬─────────────┬─────────────┬───┘
                             │             │             │             │
                       ┌─────▼───┐  ┌──────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
                       │ Web     │  │ Companies  │ │ Find a    │ │ Contracts │
                       │ search  │  │ House      │ │ Tender    │ │ Finder    │
                       │ (Tavily)│  │ (PSC/      │ │ (OCDS)    │ │ (OCDS)    │
                       │         │  │ officers)  │ │           │ │           │
                       └─────────┘  └────────────┘ └───────────┘ └───────────┘
                                          UK PUBLIC API CLIENTS (tools)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Config store** | Persist user-defined firms (+ capability tags) and topics | Postgres (Drizzle); read by orchestrator and dashboard |
| **API clients** (4) | Thin typed wrappers: web search, Companies House, Find a Tender, Contracts Finder. No business logic — fetch + Zod validate + return | Called only by the orchestrator (as AI-SDK tools or directly); write raw payloads to cache |
| **OCDS adapter** | Normalise FTS + Contracts Finder OCDS releases into one internal `Notice`/`Award` shape; match notices to firms by name + CH number | Wraps the two procurement clients; consumed by orchestrator and dashboard |
| **Research orchestrator** | Per `(firm × topic)` AI-SDK tool-calling loop producing schema-validated findings with citations | Reads config; calls API-client tools; writes findings + raw payloads to cache; updates job status |
| **Job runner / queue** | Owns long-running execution, status, retries, per-firm refresh. Redis queue (BullMQ) for durable dispatch; `jobs` DB table for status tracking and UI visibility | Enqueued by dashboard refresh action (server action pushes to BullMQ); driven by long-running worker process; writes `jobs` status + `progressMessage` |
| **Analysis layer** | Derive cross-cutting outputs from cached findings: ownership (UK vs non-UK), conflicts/audit relationships, partnerships, consortium recommendations, risk flags | Reads findings + CH/OCDS data; writes `firm_relationships` + analysis records |
| **Cache (Postgres)** | Single source of truth: config, raw payloads, structured findings, relationships, job state | Written by orchestrator/analysis; read by dashboard |
| **Dashboard** | Render firm profiles, filter by tag, cross-cutting views, trigger refresh, poll job status | Reads cache via RSC; calls refresh server action; polls `/api/jobs` endpoint |

**Boundary rule:** the dashboard NEVER calls an external API directly and NEVER runs an LLM call in a request handler. It only reads the cache and enqueues jobs. This keeps reads instant and makes the slow path fully asynchronous.

## Data Flow

**Write path (research):**
1. User clicks "Refresh" on a firm (or "Run initial report") in the dashboard.
2. A **server action** inserts a row into `research_jobs` (status `queued`) and returns a `jobId` immediately. It does NOT await the research.
3. The **job runner** picks up the job and, for each topic, runs the **orchestrator loop**:
   - AI-SDK agent is given the firm, the topic, and the available **tools** (web search + 3 UK API clients).
   - The model decides which tools to call, calls them, reads results, possibly iterates (bounded step limit).
   - Raw tool responses (OCDS packages, CH PSC/officers JSON, search results) are written to `raw_payloads` for auditability/citation.
   - The loop ends with a **structured-output** step: a Zod-validated `Finding` (summary, key facts, **source citations**, confidence) per topic.
4. Findings + raw payloads are written to the cache; `research_jobs.status` advances (`running` → `done`/`failed`) with progress (e.g. `4/7 topics`).
5. After per-firm findings land, the **analysis layer** recomputes cross-cutting records (ownership flags, conflict/audit edges, partnership edges, risk flags, consortium options).

**Read path (dashboard):**
1. RSC pages query the cache directly (Drizzle) — fast, no external calls.
2. While a refresh is in flight, the client **polls** `GET /api/jobs/{jobId}` (TanStack Query) to show per-firm progress/stale state; on `done` it revalidates the firm view.
3. Cross-cutting views (ownership split, conflict matrix, consortium recommender) read pre-computed analysis records, not live LLM output.

**Direction summary:** external APIs → orchestrator → cache → dashboard. Information only flows one way; the dashboard's sole write is "enqueue a job."

## Key Architectural Decisions

### 1. Async research jobs via Redis/BullMQ + DB status tracking (NOT synchronous request handlers)
**Decision:** Refresh is fire-and-forget: server action inserts a `jobs` DB row (for status tracking) and pushes to the Redis BullMQ queue; a long-running worker process (`npm run worker`) consumes jobs concurrently (default: 2 at a time).
**Why:** Research is minutes-per-firm and multi-step; running it inside a request would block the UI, risk timeouts, and lose work on navigation. BullMQ provides durable job dispatch, concurrency control, and a clean worker/producer boundary. The `jobs` DB table provides the observable status trail the UI polls.
**Implementation (db-worker-upgrade branch, 2026-06-14):** `runResearch()` server action → `enqueueJob()` (inserts DB row) + `researchQueue.add()` (pushes to Redis) → `src/scripts/worker-process.ts` BullMQ Worker picks up and calls `executeResearchJob()` → updates `jobs.status` + `jobs.progressMessage` per-topic → `/api/jobs` + `/jobs` page show live status via polling.

### 2. Polling over WebSockets/SSE for job status (v1)
**Decision:** Client polls a job-status endpoint with TanStack Query.
**Why:** Single user, handful of firms, refresh measured in minutes — sub-second push updates add no value. Polling every few seconds is trivial to build, stateless, and robust. SSE is a clean upgrade later (one endpoint streaming progress) if richer live progress is wanted; WebSockets are unjustified at this scale.

### 3. AI-SDK tool-calling loop with end-of-loop structured output
**Decision:** One agent loop per `(firm × topic)`; the model calls tools, then a final `generateObject`/structured-output step emits a Zod-validated `Finding`.
**Why:** Bounded, well-defined research task — no need for a heavyweight agent framework. Tool-calling lets the model choose CH vs procurement vs web per topic; the final structured step guarantees every finding carries citation fields (satisfying the "must cite sources" constraint). Cap the step count to bound cost/latency. Per-topic loops (rather than one giant per-firm prompt) keep prompts focused, make partial progress reportable, and isolate failures.

### 4. OCDS normalisation as a shared adapter
**Decision:** Model one internal `Notice`/`Award` type; both FTS and Contracts Finder map into it.
**Why:** Both speak OCDS 1.1.5 — writing the shape once avoids divergent handling and lets firm↔contract matching (by name + Companies House number) live in one place. Name-only matching is noisy in this sector; storing matched notice IDs against the firm keeps matches auditable.

### 5. Raw-payload cache separate from structured findings
**Decision:** Store both the raw API/search responses AND the derived structured findings.
**Why:** Citations must be verifiable; raw payloads are the evidence trail and let analysis/findings be recomputed without re-hitting (rate-limited) APIs. Keep raw payloads in a JSON-typed column so the cache survives a SQLite→Postgres move.

### 6. Analysis layer is derived/recomputable, not authored inline
**Decision:** Cross-cutting outputs (ownership, conflicts, partnerships, consortium, risk) are a separate pass over cached firm findings, materialised into their own records (esp. `firm_relationships`).
**Why:** These are inherently cross-firm (a conflict/partnership is an edge between two firms), so they can't be produced by a single-firm research loop. Making them a recompute step means re-running after any firm refresh keeps the whole picture consistent. A simple relationship table + badges/matrix in TanStack Table covers v1; defer graph visualisation (React Flow).

## Patterns to Follow

### Pattern 1: Redis queue (dispatch) + DB table (status)
**What:** `runResearch()` server action calls `enqueueJob()` (inserts a `jobs` row with `status = "pending"`) then `researchQueue.add()` (pushes `{ firmId, jobId }` to Redis BullMQ queue). The long-running worker process picks up the BullMQ job, transitions `jobs.status` through `pending → running → done/failed`, and writes `jobs.progressMessage` per-topic so the `/jobs` page shows granular progress. The `jobs` table is the observable status trail; Redis is the dispatch mechanism.
**When:** Any user-triggered refresh or the initial-report run.

### Pattern 2: Tool-per-source, model orchestrates
**What:** Register web search + each UK client as AI-SDK tools with typed (Zod) inputs/outputs; let the model select per topic.
**When:** Inside the per-topic research loop.

### Pattern 3: Citation-carrying structured findings
**What:** `Finding` schema requires `sources: [{title, url, retrievedAt}]`; the loop fails/flags a finding lacking sources.
**When:** Final structured-output step of every loop.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Researching inside the request/render path
**Why bad:** Blocks UI, hits timeouts, re-runs expensive LLM work on every view, loses work on navigation.
**Instead:** Enqueue a job; render from cache; poll status.

### Anti-Pattern 2: One mega-prompt per firm covering all topics
**Why bad:** Hard to validate, no partial progress, one failure loses everything, weaker citations.
**Instead:** Per-topic loops with focused prompts and per-topic findings.

### Anti-Pattern 3: Computing cross-cutting analysis ad hoc in the UI
**Why bad:** Relationship/conflict logic is cross-firm and stateful; recomputing it in components is slow and inconsistent.
**Instead:** Materialise analysis records on a recompute pass; UI just reads them.

### Anti-Pattern 4: Dashboard calling external APIs directly
**Why bad:** Couples read latency to flaky/rate-limited third parties; bypasses the cache and citation trail.
**Instead:** All external access goes through the orchestrator and lands in the cache first.

## Suggested Build Order (dependency-driven)

This ordering is the primary input to roadmap phase structure. Each layer is usable/testable before the next depends on it.

1. **Schema + config store + API clients (foundation).**
   Postgres schema (firms, topics, findings, raw_payloads, research_jobs, firm_relationships) via Drizzle; thin typed clients for Companies House, FTS, Contracts Finder, web search; OCDS adapter + firm↔notice matching. *Verifiable standalone via scripts — no UI needed.* Everything depends on this.

2. **Research orchestrator + job runner (the engine).**
   AI-SDK per-topic tool-calling loop with structured `Finding` output and citations; `research_jobs` enqueue/claim/status contract; write findings + raw payloads to cache. *Depends on #1.* This is the highest-risk component (LLM behaviour, tool wiring, rate limits) — flag for deeper research.

3. **Read-side dashboard core (make it visible).**
   RSC firm-profile pages reading cached findings; capability-tag filtering (TanStack Table); refresh server action that enqueues a job; job-status endpoint + client polling. *Depends on #1 (read) and #2 (refresh).* Delivers the first end-to-end loop: configure → research → view.

4. **Cross-cutting analysis layer (the differentiated value).**
   Ownership (UK vs non-UK from PSC), conflict/audit + partnership edges (`firm_relationships`), risk flags, consortium recommender; recompute on refresh. *Depends on #2's findings being populated.* Higher conceptual/ambiguity risk (consortium logic, conflict heuristics) — flag for deeper research.

5. **Polish + initial report.**
   Cross-cutting visual views (matrix/badges, Recharts), run the seeded 12 firms × 7 topics, verify citations end-to-end.

**Critical dependency notes:**
- #1 gates everything; build and test clients in isolation first.
- #3 can begin against hand-seeded cache rows in parallel with #2 (decouples UI work from LLM tuning).
- #4 cannot start meaningfully until #2 produces real findings for multiple firms (relationships need ≥2 firms researched).

## Scalability Considerations

| Concern | At 12 firms (v1 — current) | At ~100 firms | Cloud / multi-user (future) |
|---------|----------------------------|---------------|------------------------------|
| Job execution | Long-running BullMQ worker process (`npm run worker`), concurrency=2 | Increase `WORKER_CONCURRENCY`; add CH rate-limit throttling in client layer | Horizontal workers on Railway/Fly; Redis already the shared queue |
| Status updates | `/jobs` page polls every 2s (active) / 10s (idle) | Same — still sufficient | SSE/WebSocket if sub-second progress matters |
| Cache | Postgres 16 (docker-compose) | Same | Managed Postgres (Neon/Supabase/RDS); connection string swap only |
| Analysis recompute | Full recompute per refresh | Incremental: only edges touching the refreshed firm | Same, plus background recompute job |
| Rate limits | Sequential per topic within a job | Token-bucket / throttle in client layer + cache to avoid re-fetch | Shared cache, per-key throttling |

## Sources

- Next.js background-jobs / DB-queue + polling vs SSE/WebSocket pattern — https://www.inngest.com/blog/background-jobs-realtime-nextjs , https://dev.to/richardlau/implementing-real-time-status-updates-with-server-sent-events-in-nextjs-4da1 (HIGH on pattern, MEDIUM on local-first specifics)
- AI SDK tool-calling loop + structured output (generateObject / output option, bounded steps) — https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling , https://ai-sdk.dev/docs/troubleshooting/tool-calling-with-structured-outputs , https://ai-sdk.dev/docs/agents/building-agents (HIGH)
- UK API endpoints/standards (OCDS, Companies House PSC) and matching guidance — inherited from STACK.md (verified against official GOV.UK + OCP docs) (HIGH)
