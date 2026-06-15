<!-- GSD:project-start source:PROJECT.md -->

## Project

**Firm Intelligence Dashboard**

A configurable web dashboard that conducts deep research on a user-defined list of firms using AI-assisted web search and structured UK public procurement sources, then presents findings in an interactive, filterable interface. Built initially to support bid/consortium planning for UK civil nuclear and defence programmes, but designed to work with any set of firms and research topics.

**Core Value:** Given a list of firms and research questions, surface the intelligence needed to decide which firms to team with and in what combination — in one place, without manual searching.

### Constraints

- **Data**: Public domain only — no paid APIs, no restricted data
- **Hosting**: Local-first for now; architecture should not preclude future cloud deployment
- **Research quality**: AI research must cite sources so findings are verifiable
- **Stack**: No preference stated — choose for speed of build and dashboard quality

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Context Recap

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js (App Router) | 15.x (latest 15.5+) | Full-stack app: UI, server route handlers, server actions | One language end-to-end, server-side data fetching for long research jobs, RSC for fast dashboard render, trivial path to Vercel/cloud later. Server Actions are stable in 15. |
| React | 19.x | UI runtime | Bundled with Next 15; Server Components reduce client JS for a data-heavy dashboard. |
| TypeScript | 5.6+ | Type safety across API clients, DB rows, LLM schemas | Strongly typed OCDS / Companies House responses and Zod-validated LLM output prevent a whole class of integration bugs. |
| Node.js | 20 LTS or 22 LTS | Runtime | Next 15 baseline; 22 LTS preferred for longevity. |

### Database & Job Queue

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16 (docker-compose) | Primary database: firm profiles, per-topic research findings, raw API responses, job status, refresh timestamps | Production-grade, cloud-portable. Runs locally via `docker compose up -d db`. |
| Drizzle ORM | 0.45+ | Schema, migrations, typed queries | TypeScript-native, thin over SQL. `drizzle-orm/postgres-js` dialect. Push schema with `npm run db:push`. |
| Redis | 7 (docker-compose) | Job queue transport for BullMQ | Durable dispatch of research jobs from server action to worker. Runs locally via `docker compose up -d redis`. |
| BullMQ | 5.x | Job queue library | Redis-backed queue: durable dispatch, concurrency control, graceful shutdown. Producer: `src/lib/jobs/bull.ts`. Worker: `npm run worker`. |

### AI / LLM Research Orchestration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel AI SDK | 5.x | LLM calls, tool calling, structured output, streaming, agentic loops | The de-facto 2025 TypeScript LLM toolkit. `generateObject`/`streamObject` give Zod-validated structured findings (cite-able fields); tool calling drives the research loop; provider-agnostic so you can swap models. |
| Zod | 3.23+ | Schemas for LLM structured output and API response validation | Pairs natively with AI SDK `generateObject`; enforces that every finding has the source/citation fields the project requires. |
| Anthropic Claude (via `@ai-sdk/anthropic`) | provider 1.x | Primary research/reasoning model | Strong long-context synthesis and citation behaviour for multi-source firm analysis. Provider-agnostic SDK keeps OpenAI/Gemini as drop-in alternatives. |
| Option | Why | When |
|--------|-----|------|
| **Tavily Search API** (recommended) | Purpose-built LLM search: returns clean, citation-ready content + URLs, generous free tier, trivial AI SDK tool wrapper. Directly satisfies "must cite sources". | Default choice. |
| Brave Search API | Independent index, cheap, good for general web/news | If you want a raw search index rather than LLM-tuned results. |
| Anthropic/OpenAI native web search tool | No extra vendor; server-side web search built into the model | If you want to minimise dependencies and accept the model provider's search. |

### UK Public Data API Integrations

| Source | Endpoint / Standard | Auth | Notes |
|--------|---------------------|------|-------|
| **Companies House Public Data API** | `https://api.company-information.service.gov.uk` — `/company/{number}` (profile), `/company/{number}/officers`, `/company/{number}/persons-with-significant-control` (PSC = ownership), `/search/companies` | **Free API key**, HTTP Basic auth (API key as username, blank password) | PSC register is fully public — directly answers "which firms are not UK owned" and group/ownership structure. Rate limit ~600 requests / 5 minutes. |
| **Find a Tender Service (FTS)** | `https://www.find-tender.service.gov.uk/api/{version}/ocdsReleasePackages` and `/ocdsRecordPackages` | **No key** | OCDS 1.1.5 JSON (formerly OJEU). Higher-value / above-threshold UK procurement notices. Open Government Licence. |
| **Contracts Finder** | `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search` (OCDS) | **No key** | OCDS JSON. Below-threshold + general UK government contracts. Open Government Licence. |

- Both procurement APIs speak **OCDS** (Open Contracting Data Standard) JSON — model a shared OCDS release/award type once and reuse across FTS + Contracts Finder.
- Match firms to notices by company name AND Companies House number where possible (name-only matching is noisy in this sector — many similarly named entities). Store matched notice IDs against the firm to make matches auditable.
- Cache raw OCDS payloads in Postgres so re-analysis doesn't re-hit the APIs; refresh on manual per-firm refresh.
- These structured sources provide the **verifiable** contract/ownership data; the AI/web-search layer fills reputation/partnership/risk gaps.

### Dashboard UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Styling | Standard with Next 15 / shadcn; fast iteration. |
| shadcn/ui | latest (CLI-installed) | Component primitives (cards, dialogs, badges, tabs, filters) | Copy-in components you own; perfect for a bespoke intelligence dashboard layout. Pairs natively with TanStack Table. |
| TanStack Table | v8 | Firm/notice data grids: sorting, multi-column filtering, capability-tag filtering | Headless, powerful filtering — directly serves "filter firms by capability tag" and tabular contract data. |
| Recharts | 2.x | Charts (ownership split, risk distribution, contract value over time) | Simplest React charting for dashboard widgets; good enough for v1 visuals. |
| TanStack Query | v5 | Client-side data fetching/cache for refresh actions | Smooth manual-refresh UX (loading/stale states per firm) layered over server data. Optional if relying mainly on RSC + server actions. |
| lucide-react | latest | Icons | Ships with shadcn. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 full-stack | FastAPI (Py) + React SPA | Split stack adds wiring/CORS/duplication for a single-user app; no benefit at this scale. |
| Framework | Next.js 15 | Remix / TanStack Start | Both fine; Next has the deepest dashboard/AI-SDK ecosystem and docs in 2025. |
| Database | Postgres 16 | SQLite (original plan) | Migrated to Postgres (db-worker-upgrade) for cloud portability and concurrent worker DB writes. |
| Job queue | BullMQ + Redis | child_process.spawn() per job | Replaced spawn pattern with BullMQ (db-worker-upgrade) for durable dispatch, concurrency control, and clean worker/producer separation. |
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

# Scaffold

# Database

# AI / LLM

# web search provider (pick one)

# UI / dashboard

## Sources

- Companies House API authentication & overview — https://developer.company-information.service.gov.uk/authentication , https://developer.company-information.service.gov.uk/overview (HIGH)
- Find a Tender developer docs (OCDS 1.1.5) — https://www.find-tender.service.gov.uk/Developer/Documentation , https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages (HIGH)
- Contracts Finder API docs — https://www.contractsfinder.service.gov.uk/apidocumentation (HIGH)
- OCP Data Registry (UK FTS + Contracts Finder OCDS) — https://data.open-contracting.org/en/publication/41 , https://data.open-contracting.org/en/publication/128 (HIGH)
- Vercel AI SDK 5 — https://vercel.com/blog/ai-sdk-5 , https://ai-sdk.dev/docs/introduction (HIGH)
- Next.js 15 / shadcn / TanStack Table dashboard pattern — https://railway.com/deploy/nextjs-155-server-actions-with-shadcn , https://devpalma.com/en/posts/shadcn-tables (HIGH)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## Commit & Release Workflow

These rules apply to every commit, without exception.

### Before committing

1. Run the full test suite and fix any failures before committing.
2. Do not commit with failing tests.

### Before committing (continued)

3. **PENDING_RELEASE.md** — append any deployment steps required for this change (both dev and prod). Create the file if it doesn't exist. Format:
   ```
   ## <commit subject>
   ### Dev
   - <step>
   ### Prod
   - <step>
   ```
4. **RELEASE_NOTES.md** — append a brief summary of the commit grouped by date with bullet points. Create the file if it doesn't exist. Format:
   ```
   ## YYYY-MM-DD
   - <summary of what changed and why>
   ```
5. Stage `PENDING_RELEASE.md` and `RELEASE_NOTES.md` alongside the other changes so they are included in the same commit and PR.

### Branching & pushing

5. **Never push directly to `main`.**
6. Always work on a feature branch.
7. When ready to push, confirm with the user first, then submit a PR (never force-push to main).

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
