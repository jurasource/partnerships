# Project Research Summary

**Project:** Firm Intelligence Dashboard
**Domain:** AI-assisted firm intelligence / competitive-intelligence dashboard for UK public-sector bid & consortium planning (civil nuclear + defence)
**Researched:** 2026-06-13
**Confidence:** HIGH (stack, architecture), MEDIUM-HIGH (features, pitfalls)

## Executive Summary

This is a single-user, local-first intelligence dashboard that runs AI-assisted deep research on a configurable list of firms across configurable topics, blends that with structured data from three free UK public APIs (Companies House, Find a Tender, Contracts Finder), caches everything, and presents interactive, filterable findings plus cross-cutting analysis (ownership, conflicts, partnerships, consortium recommendations, risk).

The product sits at the intersection of three established categories — competitive intelligence, third-party risk / due diligence, and relationship intelligence — but its actual thesis is a **consortium-planning lens** no off-the-shelf tool offers: "given my specific shortlist of firms, what is the best clean bid team and what blocks it?"

The recommended approach is **one full-stack TypeScript application** (Next.js 15 App Router + React 19). The defining architectural shape is a **slow, multi-source research pipeline (write-side) feeding a fast, structured read model (dashboard)**, with a SQLite/Drizzle cache as the single source of truth. The dominant risk is **trust**: a single confident fabrication destroys credibility and can drive a wrong, legally-sensitive bid decision. Mitigation is architectural and must be built before the dashboard.

## Recommended Stack

| Component | Technology | Confidence |
|-----------|-----------|------------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript | HIGH |
| Database | SQLite (better-sqlite3 11.x) + Drizzle ORM | HIGH |
| AI layer | Vercel AI SDK 5 + Zod + Anthropic Claude | HIGH |
| Web search | Tavily Search API (citations-ready) | MEDIUM |
| UK APIs | Companies House API, Find a Tender (OCDS), Contracts Finder (OCDS) — all free | HIGH |
| Dashboard UI | shadcn/ui + TanStack Table v8 + TanStack Query v5 + Recharts | HIGH |

**NOT for v1:** paid data vendors, web scraping, agent frameworks, Prisma, separate Python backend, vector DB/RAG, React Flow graph visualisation.

## Table Stakes vs Differentiators

### Table Stakes (must have)
- Firm profile page aggregating all research topics — core unit of every CI tool
- Capability tagging + filter (Nuc / Infra / Cons)
- Per-topic research findings with cited sources — most important quality feature
- UK contract history per firm via Contracts Finder + Find a Tender, matched by CH number
- Ownership / nationality flag (UK vs non-UK) from Companies House PSC
- Per-firm risk flags with severity and sources
- Manual per-firm refresh with visible "last researched" timestamp
- Cross-firm comparison table (sortable)
- Source/citation panel distinguishing structured facts from AI findings

### Differentiators (what makes this unique)
- **Conflict-of-interest detection** (audit relationships + direct competitors) — statutory-relevant under Procurement Act 2023
- **Consortium recommendation engine** — rules-based and explainable, the headline use case
- Existing-partnership map from shared awards + announced JVs
- Conflict-aware consortium scoring
- Foreign-ownership / NSI-sensitivity overlay on consortium view
- Configurable firms + topics (beyond the initial 12/7)

### Defer to v2
- Network-graph visualisation (start with simple list; React Flow later)
- Consortium engine until underlying data (contracts, COI, partnerships) is reliable — a recommendation on shaky data is worse than none

## Architecture Overview

**Core principle:** The dashboard NEVER calls an external API or runs an LLM in a request handler — it only reads the cache and enqueues jobs.

**Components:**
1. **Config store** — data-driven firms (+ capability tags) and topics
2. **API clients (4) + OCDS adapter** — typed `fetch`+Zod wrappers; normalise Find a Tender + Contracts Finder into one internal `Notice`/`Award` shape; match firms by Companies House number
3. **Research orchestrator** — per `(firm × topic)` AI-SDK tool-calling loop producing Zod-validated, citation-carrying findings
4. **Job runner / queue** — DB-backed `research_jobs` table: enqueue → claim → status; handles retries, idempotency, partial progress
5. **Analysis layer** — derived/recomputable cross-cutting records (ownership, conflict/audit edges, partnership edges, risk, consortium) materialised into `firm_relationships`
6. **Cache (SQLite)** — single source of truth: config, raw payloads, findings, relationships, job state
7. **Dashboard (read-side)** — RSC pages, TanStack Table filtering, refresh action, job-status polling, Recharts widgets

**Build order:** Phase 1 (schema + API clients + entity map) gates everything → Phase 2 (research engine) is highest-risk → Phase 3 (dashboard) can start in parallel against hand-seeded data → Phase 4 (cross-cutting analysis) needs ≥2 firms researched → Phase 5 (consortium recommender + initial report) is the capstone.

## Top 5 Pitfalls

1. **Treating AI output as fact (hallucination + fabricated citations)** — Build claim→source grounding, faithfulness checks, explicit "not found", and confidence tiering **before** the dashboard. Retrofitting verification is a rewrite.

2. **Firm name matching / entity resolution treated as trivial** — The 8-char Companies House company number is the only reliable identifier. Resolve each firm to CH numbers up front as a human-confirmed entity map with an alias list (SNC-Lavalin → AtkinsRéalis → Atkins Realis). This is the foundation everything sits on.

3. **Believing the procurement APIs give complete data** — Use them as a floor, not a ceiling; defence/nuclear work is frequently exempt or unpublished. Never assert absence ("no published contracts found", not "holds no contracts").

4. **Trusting Companies House PSC as ground truth for ownership** — PSC is self-reported, banded, and does not trace chains to the foreign ultimate parent (KBR/Amentum US, AtkinsRéalis Canada). Corroborate with AI web research; flag disagreements for human review.

5. **Long research jobs inside the HTTP request cycle** — Anything over ~3s goes to a background worker with a job id + polling, idempotency keys, backoff, and partial-progress persistence.

## Suggested Phase Structure

### Phase 1: Data Foundation
Schema, config store, entity map (CH numbers for all 12 firms), API clients (Companies House, Find a Tender, Contracts Finder, web search), OCDS adapter. **Gates everything else.**

### Phase 2: Research Engine
Async job runner + per-(firm × topic) AI-SDK tool-calling loop with Zod-validated findings, mandatory source citations, faithfulness checks, confidence tiering. **Highest-risk component.**

### Phase 3: Dashboard Core
RSC firm-profile pages, capability-tag filtering, cross-firm comparison table, refresh server action, job-status polling, citation panel, staleness flags. **Can start in parallel against seeded data.**

### Phase 4: Cross-Cutting Analysis
Ownership analysis, conflict/audit-relationship detection, partnership map, risk flags — all materialised as recomputable relationship records.

### Phase 5: Consortium Recommender + Initial Report
Rules-based explainable recommender (cover capability mix, exclude conflict pairs, prefer relevant contracts), foreign-ownership overlay, then run the seeded 12 firms × 7 topics end-to-end.

## Key Decisions Required Before Phase 1

| Decision | Options | Notes |
|----------|---------|-------|
| Web-search vendor | Tavily vs Brave vs native model | Keep behind a tool interface; all viable |
| Entity map approach | CH number + alias list, human-confirmed | Must be confirmed for initial 12 firms |
| PSC ownership caveat wording | "UK-incorporated, ultimate parent: [country]" | UI must show sourcing clearly |
| Conflict heuristics | AI-assisted lead generation vs manual | Phase 4 must spec this explicitly |
| Consortium rule set | Capability cover + conflict exclusion + contract weighting | Phase 5 must design rules + explainability |

---
*Research completed: 2026-06-13 | Ready for roadmap: yes*
