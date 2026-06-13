# Walking Skeleton — Firm Intelligence Dashboard

**Phase:** 1
**Generated:** 2026-06-13

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

A user runs `npm run dev`, opens `/` (Dashboard) and `/firms`, sees the 12 pre-seeded firms loaded from SQLite, clicks **Add Firm**, submits the dialog form, and the new firm is written to the SQLite database and appears in the list — proving framework + routing + a real DB read AND a real DB write + a real wired UI interaction all work together.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 App Router + React 19 + TypeScript 5.6+ | Locked in CLAUDE.md §Technology Stack. One TypeScript codebase for UI + server actions + long-running research (Phase 2). RSC for fast data-dense dashboard render. |
| Data layer | SQLite via `better-sqlite3` 11.x + Drizzle ORM 0.36+ | Local-first, zero-ops, synchronous fast reads for a single-user tool. Drizzle keeps SQL ANSI-friendly so a future Postgres swap is a dialect change (CLAUDE.md migration path). |
| DB file location | `./data/app.db` (configurable via `DATABASE_PATH` env var, default `./data/app.db`) | Lives in project for local-first; env-overridable per the CONTEXT.md "specifics" note. `data/` git-ignored. |
| Schema migration | `drizzle-kit push` (schema-push, not generated migration files, in Phase 1) | Single-user local dev; push is the fastest loop. Non-interactive, exits 0. Migration files can be added later for cloud. |
| Server-side data access | Next.js Server Components (RSC) read via Drizzle directly; mutations via Server Actions | ARCHITECTURE.md boundary rule: dashboard reads cache directly, never calls external APIs in render. Server Actions handle writes. |
| UI system | shadcn/ui (New York, neutral, CSS variables) + Tailwind CSS 4 + TanStack Table v8 + lucide-react | Locked in UI-SPEC.md. Copy-in components owned in-repo. |
| App shell | Persistent left sidebar (shadcn `sidebar` primitive) collapsible 256px ↔ 56px rail | D-04 / UI-SPEC layout contract. Established once in Phase 1, inherited by all later phases. |
| Directory layout | `src/app/*` (routes), `src/db/*` (schema, client, seed), `src/components/*` (shared + ui), `src/lib/*` (clients, adapters, actions) | Standard Next.js App Router layout; feature logic under `src/lib`. |
| External API access | Thin `fetch` + Zod typed clients under `src/lib/clients/*`; no SDKs for UK APIs | STACK.md: UK clients are plain fetch + Zod. Server-side only (API keys never reach the client). |
| Job queue | SQLite-backed `jobs` table (enqueue/claim/status), NOT in-process-only | D-07: persists across dev-server restarts. Phase 1 ships the table + enqueue contract; Phase 2 adds the worker loop. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js 15, TypeScript, Tailwind 4, ESLint, shadcn init)
- [x] Routing — `/` (Dashboard), `/firms`, `/topics` real routes under the sidebar shell
- [x] Database — real read (seeded firms render) AND real write (Add Firm server action inserts a row)
- [x] UI — Add Firm dialog wired to a Server Action that writes to SQLite
- [x] Deployment — documented local full-stack run: `npm run dev` exercises read + write end-to-end (no cloud needed; local-first per CONTEXT.md)

## Out of Scope (Deferred to Later Slices)

> Anything that is *not* in the skeleton. Be explicit — this list prevents future phases from re-litigating Phase 1's minimalism.

- AI research loop, `generateObject`/Tavily, findings population (Phase 2 — `findings` table schema is created empty in Phase 1 but never written)
- Job *worker* that actually runs research (Phase 2 — Phase 1 ships only the `jobs` table + enqueue/status contract)
- Firm profile pages, citation panel, contract-history rendering (Phase 3)
- Ownership chains, conflict/partnership/risk analysis, `firm_relationships` (Phase 4)
- Consortium recommender + initial report (Phase 5)
- Charts/Recharts, React Flow graph views (Phase 3+)
- Cloud deployment, Postgres, auth/multi-user (explicitly out of scope per REQUIREMENTS.md)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Per-(firm × topic) AI research loop writes citation-carrying findings; job worker consumes the `jobs` table; visible job status.
- Phase 3: Firm profile pages + citation panel + contract history; comparison-table filtering/sorting + refresh from dashboard.
- Phase 4: Ownership/conflict/partnership/risk analysis materialised into `firm_relationships`; recompute on refresh.
- Phase 5: Rules-based consortium recommender with conflict exclusion + NSI overlay; seeded 12×7 end-to-end initial report.
