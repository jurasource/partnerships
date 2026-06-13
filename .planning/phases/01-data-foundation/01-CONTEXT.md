# Phase 1: Data Foundation - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the app scaffold and the trustworthy, configurable data layer: Next.js 15 project skeleton with Tailwind + shadcn/ui, Drizzle/SQLite schema (firms, topics, procurement records, research jobs, findings), a pre-seeded entity map for the initial 12 firms with verified Companies House numbers, three UK data API clients (Companies House, Contracts Finder, Find a Tender) that return normalised + deduped procurement/ownership data into the local cache, and a SQLite-backed job queue skeleton ready for Phase 2's research engine.

Phase 1 does NOT run AI research, generate findings, or build the full research dashboard — those land in Phases 2 and 3.

</domain>

<decisions>
## Implementation Decisions

### Companies House Number — Entity Map
- **D-01:** Initial 12 firms are pre-seeded via a TypeScript seed file with pre-verified CH numbers and canonical names (including aliases, e.g. SNC-Lavalin → AtkinsRéalis). No first-run wizard needed.
- **D-02:** All seeded CH numbers are editable via the config UI after first run — users can correct a number if the seed is wrong.
- **D-03:** When adding a new firm beyond the seeded 12, manual CH number entry is the primary path, with an optional "Search CH" button that queries the Companies House `/search/companies` endpoint and lets the user pick from results. CH number auto-fills on selection.

### Config UI Navigation
- **D-04:** App uses a persistent left sidebar as the top-level navigation. Sidebar links include: Dashboard, Firms, Topics (and in later phases: Analysis, Consortium). This pattern scales as Phase 3–5 add new views.
- **D-05:** Landing page on app open is the Dashboard (firm comparison table) — the primary read view.
- **D-06:** Firm add/edit UI opens in a shadcn Dialog (modal). Same pattern for topic add/edit. Keeps the firm/topic list visible behind the form.

### Job-Runner Skeleton
- **D-07:** Job queue is SQLite-backed (not in-process async). Job records persist across dev-server restarts, making job status always queryable. This is the foundation Phase 2 builds its research loop on.
- **D-08:** Jobs table schema (minimal): `id`, `firm_id`, `topic_id` (nullable — null means "all topics for this firm"), `status` (pending | running | done | failed), `created_at`, `started_at`, `completed_at`, `error_message`. No retry counts or full audit trail in Phase 1.

### OCDS Normalisation and Deduplication
- **D-09:** Deduplication happens at write time: OCDS records are upserted keyed on the OCDS `ocid` (notice ID). If the same notice arrives from both Contracts Finder and Find a Tender, only one record is stored. Source provenance (which API it came from) is stored as a column.
- **D-10:** Both the raw JSON blob (full OCDS payload) and normalised columns (title, date, value, supplier CH number, award date, contracting authority) are stored per procurement record. Raw blob enables re-parsing if schema changes; normalised columns enable fast SQL queries. This matches the ROADMAP's cache-with-manual-refresh design.

### Finding Schema (Phase 1 DB — populated in Phase 2)
- **D-11:** The `findings` table is designed in Phase 1 but left empty until Phase 2 runs research. Schema includes mandatory citation fields: `source_url`, `source_title`, `raw_snippet` (the exact retrieved text), and `confidence` (HIGH | MEDIUM | LOW). This avoids a schema migration mid-build when Phase 2 adds the research engine.
  - HIGH = from structured UK API (Companies House / Contracts Finder / FTS)
  - MEDIUM = AI-derived with a cited source
  - LOW = AI-derived without a verifiable source (should trigger "not found" output instead)

### Folded Todos
- **"Enforce source citations on all research findings"** (from .planning/todos/pending/): This is a cross-cutting architectural constraint that originates in Phase 2 (RES-03) but has a Phase 1 implication. Decision: design the citation schema fields (`source_url`, `source_title`, `raw_snippet`, `confidence`) in the Phase 1 `findings` table now, so Phase 2 inherits a complete schema rather than adding columns mid-build. The enforcement rules (no unsourced claims, explicit "not found") are Phase 2's problem — Phase 1 only locks the schema contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & Architecture Decisions
- `CLAUDE.md` §Technology Stack — full stack decisions locked (Next.js 15, Drizzle/SQLite, AI SDK, shadcn/ui, TanStack Table). Read before making any technology choices.
- `.planning/research/STACK.md` — detailed rationale for all stack choices including alternatives considered.
- `.planning/research/ARCHITECTURE.md` — architectural patterns and data flow design.

### Requirements
- `.planning/REQUIREMENTS.md` §Configuration (CONF-01 to CONF-06) — full firm/topic config requirements.
- `.planning/REQUIREMENTS.md` §UK Data Integration (DATA-01 to DATA-05) — full UK API integration requirements including matching by CH number and dedup.

### UK Data APIs
- Companies House API: `https://developer.company-information.service.gov.uk/authentication` — auth (free API key, HTTP Basic), rate limit 600 req/5 min.
- Companies House API: `https://developer.company-information.service.gov.uk/overview` — available endpoints.
- Find a Tender: `https://www.find-tender.service.gov.uk/Developer/Documentation` — OCDS 1.1.5 docs.
- Contracts Finder: `https://www.contractsfinder.service.gov.uk/apidocumentation` — OCDS JSON API docs.

### Phase Goal
- `.planning/ROADMAP.md` §Phase 1 — success criteria that govern what "done" means for this phase.

No external specs or ADRs beyond the above — requirements are fully captured in REQUIREMENTS.md and ROADMAP.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is Phase 1; the project is a blank directory.

### Established Patterns
- None yet — patterns will be established during Phase 1 execution.

### Integration Points
- Phase 2 (Research Engine) will consume: the `firms` table, `topics` table, `jobs` table, and `findings` table schema defined in Phase 1.
- Phase 3 (Dashboard) will consume: the `procurement_records` table and `firms` table for the comparison view.
- All phases inherit the sidebar nav layout shell established in Phase 1.

</code_context>

<specifics>
## Specific Ideas

- The initial 12 firms and 7 topics (specified in PROJECT.md §Context) are the seed data. The seed file must contain pre-verified Companies House numbers — these should be looked up and confirmed before the seed file is written (not auto-generated).
- The sidebar should be expandable/collapsible to give the dashboard more screen width when needed (nice-to-have; planner can decide if it adds implementation complexity).
- The app must be runnable locally with `npm run dev` and no cloud services required. SQLite file lives in the project root or a configurable path.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

### Reviewed Todos (not folded)
- The citation enforcement todo was partially folded (schema design in Phase 1). The enforcement behaviour (Phase 2 research loop must output citations or explicit "not found") is deferred to Phase 2. The cross-cutting analysis requirements (ANAL-01 sourced evidence, PROF-02 citation panel) are deferred to Phases 3 and 4.

</deferred>

---

*Phase: 1-Data Foundation*
*Context gathered: 2026-06-13*
