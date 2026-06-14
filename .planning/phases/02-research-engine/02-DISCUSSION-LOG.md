# Phase 2: Research Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 2-Research Engine
**Areas discussed:** Web search provider, Research job architecture, Research granularity & progress, Structured data → AI context

---

## Todos Folded

All three matched todos were folded into Phase 2 scope:
- "Enforce source citations on all research findings" (planning, score 0.6)
- "View firm refresh results after data pull" (ui, score 0.9)
- "Background worker / Railway note" (general, score 0.6)

---

## Web Search Provider

| Option | Description | Selected |
|--------|-------------|----------|
| Tavily | Purpose-built for LLM research. Clean snippets + citation-ready URLs. Free tier ~1000 searches/month. | ✓ |
| Brave Search API | Independent index. Raw results — more wiring for citation-ready output. | |
| Model-native web search | Anthropic built-in tool. Zero extra vendor but less control over snippets. | |

**User's choice:** Tavily

| Option | Description | Selected |
|--------|-------------|----------|
| Thin WebSearchClient interface | Provider interface wrapping Tavily — swap later with config change. | ✓ |
| Call Tavily directly | Simpler — update call sites if swapping. | |

**User's choice:** Thin interface (recommended)

---

## Research Job Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| API Route fire-and-forget | Action enqueues + calls POST /api/research/run (no await). Route handler does the work. Non-blocking UI, Railway-extractable. | ✓ |
| Synchronous server action | Runs all AI research inline. Fine for local-first but hangs for minutes. | |
| Separate worker process | Node.js script polling SQLite. Closest to Railway design, more setup. | |

**User's choice:** API Route fire-and-forget

| Option | Description | Selected |
|--------|-------------|----------|
| Polling (GET /api/research/status/[jobId]) | Client polls every 2-3s. Simple, cache-friendly. | ✓ |
| SSE | Streams progress events. More real-time but overkill for v1. | |

**User's choice:** Polling

| Option | Description | Selected |
|--------|-------------|----------|
| Mark job failed, keep partial findings | 3/7 done findings preserved. User re-triggers to fill gaps. | ✓ |
| Mark job failed, roll back findings | Clean state but loses partial progress. | |

**User's choice:** Keep partial findings on failure

---

## Research Granularity & Progress

| Option | Description | Selected |
|--------|-------------|----------|
| One job per firm (all topics in sequence) | topicId = null. Progress = "N/7 topics complete" counter from findings count. Fewer rows. | ✓ |
| One job per (firm × topic) | 7 job rows per run. More granular status, more complex orchestration. | |

**User's choice:** One job per firm

| Option | Description | Selected |
|--------|-------------|----------|
| Add lastResearchedAt to firms table | Set on job done. Simple timestamp, directly queryable. | ✓ |
| Derive from MAX(completedAt) in jobs | No schema change but slower query. | |

**User's choice:** Add lastResearchedAt column

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days staleness threshold | Weekly cadence. Matches bid review cycles. | ✓ |
| 30 days | Less nagging. For slow-changing firms. | |
| Configurable by user | Flexible but extra UI to build. | |

**User's choice:** 7 days

---

## Structured Data → AI Context

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — structured data as grounding context | CH profile + PSC + procurement records fed to AI alongside Tavily results. AI references verified data; structured findings marked HIGH confidence. | ✓ |
| No — AI searches independently | Phase 2 sends only Tavily results. Structured data shown in Phase 3 profiles. | |

**User's choice:** Feed structured data as grounding context

| Option | Description | Selected |
|--------|-------------|----------|
| Same findings table, confidence column | HIGH = structured API, MEDIUM = AI+Tavily. Phase 1 already designed this. | ✓ |
| Separate tables for structured vs AI findings | Cleaner schema split but JOIN complexity. | |

**User's choice:** Same findings table (confidence column)

| Option | Description | Selected |
|--------|-------------|----------|
| 1-2 searches per topic | One query + optional follow-up. ~168 searches per full run, within free tier. | ✓ |
| 3-5 searches (iterative) | Higher quality, 3× Tavily calls, longer run time. Exceeds free tier quickly. | |

**User's choice:** 1-2 searches per topic

---

## Claude's Discretion

- The grounding context block structure (what CH/procurement data to include, how to format it for the AI prompt) — user accepted recommended approach.
- Sentinel "not found" finding format (`sourceUrl = "not-found"`, specific summary pattern) — user accepted recommendation.

## Deferred Ideas

- SSE / live streaming progress — polling is sufficient for v1.
- Per-topic retry logic on partial failure — user can re-trigger the full firm.
- Railway worker extraction — document the contract; implement when deploying to Vercel.
- Configurable staleness threshold — hardcoded 7 days for v1.
