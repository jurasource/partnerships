# Technology Stack

**Project:** Firm Intelligence Dashboard
**Researched:** 2026-06-13
**Overall confidence:** HIGH (framework/UI/AI), HIGH (UK APIs)

## Context Recap

Single-user, local-first web dashboard. It runs AI-assisted deep research on a configurable list of firms across configurable topics, pulls structured data from three UK public APIs (Contracts Finder, Find a Tender, Companies House), caches all results in a database, and presents interactive, filterable findings with cross-cutting analysis (ownership, conflicts, partnerships, consortium recommendations). Public-domain data only, no paid feeds, must cite sources. Optimise for speed of build and dashboard quality. Architecture must not preclude future cloud deployment.

This profile points to **one full-stack TypeScript application** (Next.js App Router) rather than a separate API + SPA. Reasons: single developer, single user, research orchestration is I/O-bound and long-running (fits server-side route handlers / server actions), and the same codebase gives a first-class dashboard UI. A split backend (e.g. FastAPI + React) would add cross-cutting overhead for no benefit at this scale.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js (App Router) | 15.x (latest 15.5+) | Full-stack app: UI, server route handlers, server actions | One language end-to-end, server-side data fetching for long research jobs, RSC for fast dashboard render, trivial path to Vercel/cloud later. Server Actions are stable in 15. |
| React | 19.x | UI runtime | Bundled with Next 15; Server Components reduce client JS for a data-heavy dashboard. |
| TypeScript | 5.6+ | Type safety across API clients, DB rows, LLM schemas | Strongly typed OCDS / Companies House responses and Zod-validated LLM output prevent a whole class of integration bugs. |
| Node.js | 20 LTS or 22 LTS | Runtime | Next 15 baseline; 22 LTS preferred for longevity. |

**Confidence: HIGH.** Next.js 15 + React 19 is the mainstream 2025 full-stack choice and is well documented.

### Database & Caching

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite (via better-sqlite3) | better-sqlite3 11.x | Local-first cache of firm profiles, per-topic research findings, raw API responses, refresh timestamps | Zero-ops, single file, synchronous fast reads — ideal for a single-user local tool. Cache-with-manual-refresh is exactly SQLite's sweet spot. |
| Drizzle ORM | 0.36+ (latest 0.x) | Schema, migrations, typed queries | TypeScript-native, thin over SQL, generates types from schema. Lighter and faster to wire than Prisma for SQLite; trivial later swap to Postgres via dialect change. |
| Postgres (future) | 16+ | Cloud deployment target | NOT for v1. Drizzle's Postgres dialect means migrating later is a config + connection change, satisfying the "don't preclude cloud" constraint. |

**Migration path:** keep all SQL ANSI-friendly and avoid SQLite-only features; store raw JSON API payloads in a `text`/`jsonb`-compatible column so the cache survives a Postgres move.

**Confidence: HIGH.** SQLite + Drizzle is a standard, low-risk local-first pattern.

### AI / LLM Research Orchestration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel AI SDK | 5.x | LLM calls, tool calling, structured output, streaming, agentic loops | The de-facto 2025 TypeScript LLM toolkit. `generateObject`/`streamObject` give Zod-validated structured findings (cite-able fields); tool calling drives the research loop; provider-agnostic so you can swap models. |
| Zod | 3.23+ | Schemas for LLM structured output and API response validation | Pairs natively with AI SDK `generateObject`; enforces that every finding has the source/citation fields the project requires. |
| Anthropic Claude (via `@ai-sdk/anthropic`) | provider 1.x | Primary research/reasoning model | Strong long-context synthesis and citation behaviour for multi-source firm analysis. Provider-agnostic SDK keeps OpenAI/Gemini as drop-in alternatives. |

**Web search for AI research — pick one provider (all have free/low-cost tiers):**

| Option | Why | When |
|--------|-----|------|
| **Tavily Search API** (recommended) | Purpose-built LLM search: returns clean, citation-ready content + URLs, generous free tier, trivial AI SDK tool wrapper. Directly satisfies "must cite sources". | Default choice. |
| Brave Search API | Independent index, cheap, good for general web/news | If you want a raw search index rather than LLM-tuned results. |
| Anthropic/OpenAI native web search tool | No extra vendor; server-side web search built into the model | If you want to minimise dependencies and accept the model provider's search. |

**Recommendation:** Use the AI SDK's tool-calling loop with **Tavily** as the web-search tool and the **Companies House / Find a Tender / Contracts Finder** clients as additional tools the model can call. The model orchestrates; structured output is captured per topic with citations. Avoid heavyweight agent frameworks (LangChain/LangGraph) — overkill and slower to build for this bounded, well-defined research loop.

**Confidence: HIGH** on AI SDK + Zod; **MEDIUM** on exact search vendor (any of the three works; Tavily is the lowest-friction for citations).

### UK Public Data API Integrations

All three are free, public-domain sources. Write thin typed clients (plain `fetch` + Zod) — no SDK needed.

| Source | Endpoint / Standard | Auth | Notes |
|--------|---------------------|------|-------|
| **Companies House Public Data API** | `https://api.company-information.service.gov.uk` — `/company/{number}` (profile), `/company/{number}/officers`, `/company/{number}/persons-with-significant-control` (PSC = ownership), `/search/companies` | **Free API key**, HTTP Basic auth (API key as username, blank password) | PSC register is fully public — directly answers "which firms are not UK owned" and group/ownership structure. Rate limit ~600 requests / 5 minutes. |
| **Find a Tender Service (FTS)** | `https://www.find-tender.service.gov.uk/api/{version}/ocdsReleasePackages` and `/ocdsRecordPackages` | **No key** | OCDS 1.1.5 JSON (formerly OJEU). Higher-value / above-threshold UK procurement notices. Open Government Licence. |
| **Contracts Finder** | `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search` (OCDS) | **No key** | OCDS JSON. Below-threshold + general UK government contracts. Open Government Licence. |

**Implementation guidance:**
- Both procurement APIs speak **OCDS** (Open Contracting Data Standard) JSON — model a shared OCDS release/award type once and reuse across FTS + Contracts Finder.
- Match firms to notices by company name AND Companies House number where possible (name-only matching is noisy in this sector — many similarly named entities). Store matched notice IDs against the firm to make matches auditable.
- Cache raw OCDS payloads in SQLite so re-analysis doesn't re-hit the APIs; refresh on manual per-firm refresh.
- These structured sources provide the **verifiable** contract/ownership data; the AI/web-search layer fills reputation/partnership/risk gaps.

**Confidence: HIGH.** Endpoints, standards, and auth models verified against official GOV.UK developer docs and OCDS registry.

### Dashboard UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Styling | Standard with Next 15 / shadcn; fast iteration. |
| shadcn/ui | latest (CLI-installed) | Component primitives (cards, dialogs, badges, tabs, filters) | Copy-in components you own; perfect for a bespoke intelligence dashboard layout. Pairs natively with TanStack Table. |
| TanStack Table | v8 | Firm/notice data grids: sorting, multi-column filtering, capability-tag filtering | Headless, powerful filtering — directly serves "filter firms by capability tag" and tabular contract data. |
| Recharts | 2.x | Charts (ownership split, risk distribution, contract value over time) | Simplest React charting for dashboard widgets; good enough for v1 visuals. |
| TanStack Query | v5 | Client-side data fetching/cache for refresh actions | Smooth manual-refresh UX (loading/stale states per firm) layered over server data. Optional if relying mainly on RSC + server actions. |
| lucide-react | latest | Icons | Ships with shadcn. |

**For consortium recommendation / relationship views** (partnerships, conflicts, audit relationships): a simple matrix/grid built with TanStack Table + badges covers v1. If a graph visualisation is wanted later, add **React Flow** — but defer; do not build it for v1.

**Confidence: HIGH.** shadcn/ui + TanStack Table + Tailwind is the canonical 2025 Next.js dashboard stack.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 full-stack | FastAPI (Py) + React SPA | Split stack adds wiring/CORS/duplication for a single-user app; no benefit at this scale. |
| Framework | Next.js 15 | Remix / TanStack Start | Both fine; Next has the deepest dashboard/AI-SDK ecosystem and docs in 2025. |
| Database | SQLite | Postgres now | Premature ops for local-first single user; Drizzle makes the later migration cheap. |
| ORM | Drizzle | Prisma | Prisma heavier, slower cold-start, more codegen; Drizzle is leaner and SQL-transparent. |
| LLM toolkit | Vercel AI SDK | LangChain / LangGraph | Agent frameworks are over-engineered for a bounded research loop; slower to build, more abstraction to debug. |
| Web search | Tavily | Scraping / SerpAPI | Scraping is brittle and licence-risky; Tavily returns citation-ready content aligned to the "must cite" requirement. |
| Data grid | TanStack Table | AG Grid | AG Grid's enterprise filtering is unnecessary; TanStack is headless, free, and integrates with shadcn. |
| Charts | Recharts | Visx / D3 | D3/visx are lower-level; Recharts is faster to ship for v1 widgets. |

## What NOT to Use (and why)

- **No paid data vendors** (Bloomberg, D&B, paid procurement aggregators) — violates the public-domain constraint.
- **No web scraping of GOV.UK procurement sites** — official OCDS APIs exist and are licensed for reuse; scraping is brittle and unnecessary.
- **No heavyweight agent framework** (LangChain/LangGraph/CrewAI) for v1 — the research loop is well-bounded; AI SDK tool-calling is enough.
- **No Prisma** — Drizzle is the lighter, faster choice here.
- **No separate Python backend** — keep it one TypeScript app.
- **No vector DB / RAG infra for v1** — findings are cached structured records, not a semantic corpus. Add only if free-text search over many firms becomes a need.

## Installation

```bash
# Scaffold
npx create-next-app@latest firm-intel --typescript --tailwind --app --eslint

cd firm-intel

# Database
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit @types/better-sqlite3

# AI / LLM
npm install ai @ai-sdk/anthropic zod
# web search provider (pick one)
npm install @tavily/core            # or use Brave API via fetch

# UI / dashboard
npx shadcn@latest init
npm install @tanstack/react-table @tanstack/react-query recharts lucide-react
```

UK API clients are plain `fetch` + Zod — no packages required. Store `COMPANIES_HOUSE_API_KEY`, `ANTHROPIC_API_KEY`, and `TAVILY_API_KEY` in `.env.local`.

## Sources

- Companies House API authentication & overview — https://developer.company-information.service.gov.uk/authentication , https://developer.company-information.service.gov.uk/overview (HIGH)
- Find a Tender developer docs (OCDS 1.1.5) — https://www.find-tender.service.gov.uk/Developer/Documentation , https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages (HIGH)
- Contracts Finder API docs — https://www.contractsfinder.service.gov.uk/apidocumentation (HIGH)
- OCP Data Registry (UK FTS + Contracts Finder OCDS) — https://data.open-contracting.org/en/publication/41 , https://data.open-contracting.org/en/publication/128 (HIGH)
- Vercel AI SDK 5 — https://vercel.com/blog/ai-sdk-5 , https://ai-sdk.dev/docs/introduction (HIGH)
- Next.js 15 / shadcn / TanStack Table dashboard pattern — https://railway.com/deploy/nextjs-155-server-actions-with-shadcn , https://devpalma.com/en/posts/shadcn-tables (HIGH)
