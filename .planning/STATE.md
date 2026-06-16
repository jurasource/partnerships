---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 5 context gathered
last_updated: "2026-06-16T12:40:04.929Z"
last_activity: 2026-06-15 -- Phase 04 execution started
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 15
  completed_plans: 15
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-13)

**Core value:** Given a list of firms and research questions, surface the intelligence needed to decide which firms to team with and in what combination — in one place, without manual searching.
**Current focus:** Phase 03.1 — firm-groups

## Current Position

Phase: 03.1 (firm-groups) — EXECUTING
Plan: 3 of 3 complete
Status: Ready to execute
Last activity: 2026-06-15 -- Phase 03.1 Plan 02 complete (Groups UI)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: 8 min
- Total execution time: 0.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 3 | 24 min | 8 min |

**Recent Trend:**

- Last 5 plans: 11 min, 6 min, 7 min
- Trend: steady

*Updated after each plan completion*
| Phase 02-research-engine P01 | 15 | 3 tasks | 11 files |
| Phase 02-research-engine P03 | 12 | 2 tasks | 5 files |
| Phase 03-dashboard-profiles P01 | 10 | 3 tasks | 8 files |
| Phase 03-dashboard-profiles P02 | 4 | 3 tasks | 6 files |
| Phase 03.1 P03 | 8 | 2 tasks | 5 files |
| Phase 04 P02 | 9 min | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Phase 1 (Data Foundation) gates everything — entity map (CH numbers) and API clients must land before research.
- [Roadmap]: Trust mitigations (citation enforcement, faithfulness checks, explicit "not found") built into Phase 2 before the dashboard, not retrofitted.
- [Roadmap]: Consortium engine deferred to Phase 5 so it runs on reliable contract/COI/partnership data.
- [Plan 01-01]: shadcn 2025 uses Base UI (render prop) not Radix (asChild) — all components adapted to new API.
- [Plan 01-01]: Next.js 16.2.9 scaffolded (create-next-app@latest); 15.x was specified but 16.x App Router API is identical for Phase 1.
- [Plan 01-01]: Zod v4 .issues replaces .errors — firm-actions.ts updated accordingly.
- [Plan 01-01]: 3 of 12 seed firms have null CH numbers (Framatome UK, GEH UK, Orano UK) — unconfirmable from public search; per Pitfall 2 guidance.
- [Plan 01-02]: Edit-mode Dialog pattern — optional entity prop pre-fills fields and swaps submit copy + action (firm + topic dialogs); destructive deletes gated behind AlertDialog (T-01-06).
- [Plan 01-02]: Phase 1 Dashboard comparison table is read-only by design — filtering/refresh deferred to Phase 3 DASH requirements.
- [Plan 01-03]: OCDS dedup is at write-time via Drizzle onConflictDoNothing keyed on the UNIQUE ocid — a notice present in both CF + FTS yields one row (D-09/DATA-05).
- [Plan 01-03]: Firm↔supplier matching uses Companies House number as the primary signal (DATA-04) with alias fuzzy name-match as a weaker secondary — never name-only.
- [Plan 01-03]: refreshFirm routes through the job-queue contract (enqueue→running→done/failed). **Superseded by db-worker-upgrade:** jobs are now dispatched via BullMQ Redis queue to a long-running worker process (`npm run worker`). The `jobs` DB table still tracks status and is polled by the `/jobs` UI page.
- [Plan 01-03]: CH API key kept server-side — Search CH and refresh go through server actions. **Note:** `import "server-only"` was removed from lib files (clients, queue, research worker) in db-worker-upgrade so they can be imported by the standalone worker process (`src/scripts/worker-process.ts`). API route handlers and server actions retain `server-only`. These files are inherently server-side (Postgres, API keys) so the guard is not needed at the lib layer.
- [Plan 01-03]: vitest adopted as the project test runner (was absent); adapter unit tests prove normalise + dedup-by-ocid + CH-match.
- [Phase ?]: vi.hoisted() required for mock variable sharing across vitest module boundary
- [Plan 03-02]: Two-query merge for contractCount: select all firms + grouped count by firmId joined in JS — avoids LEFT JOIN complexity in Drizzle SQLite and keeps queries individually testable
- [Plan 03-02]: capabilityTagFilterFn.autoRemove ensures zero active tags removes the filter entirely (all firms shown) — DASH-02 all-when-empty spec
- [Phase 03 verification]: capabilityTags column has enableSorting: false (sorting a JSON array column not meaningful) — acceptable; all other non-Actions columns are sortable
- [Phase ?]: [04-02] Two-query merge for co-supplier detection: select firm ocids, then all records for those ocids, group in JS
- [Phase ?]: [04-02] extractConflicts reads both Partnerships+JVs AND Reputation+controversy findings — no conflicts-between-firms topic exists in seed
- [Phase ?]: [04-02] collaboration.ts always writes collaboration_records even when no finding exists (explicit empty-state — Pitfall 4)
- [Plan 03.1-02]: Base UI Select onValueChange typed explicitly as (value: string | null) => void — TypeScript infers Value={} when no explicit generic is passed
- [Plan 03.1-02]: View link in GroupsTable uses styled Link not Button asChild — Base UI Button does not support the asChild render pattern
- [Plan 03.1-02]: router.refresh() called after all mutations in GroupDetailClient to re-pull RSC-derived memberFirms/nonMemberFirms props
- [Phase 03.1]: Stale filter threshold is 30 days per phase spec; this deliberately differs from StalenessBadge which uses 7 days for its visual indicator
- [Phase 03.1]: filteredData computed with useMemo before useReactTable — TanStack sorting operates on already-filtered rows

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260614-hly | fix firm-form-dialog.tsx:193 — change trigger?: React.ReactNode to React.ReactElement | 2026-06-14 | cb3fd9d | [260614-hly-fix-firm-form-dialog-tsx-193-change-trig](./quick/260614-hly-fix-firm-form-dialog-tsx-193-change-trig/) |

### db-worker-upgrade Branch (2026-06-14)

Delivered on branch `db-worker-upgrade` (not yet merged):

- **Database:** SQLite → Postgres 16 (`docker-compose.yml`). `DATABASE_URL` env var required.
- **Job queue:** `child_process.spawn()` per job replaced by BullMQ + Redis. `docker compose up -d redis` required. Worker starts with `npm run worker`.
- **New files:** `src/lib/jobs/bull.ts` (queue config), `src/scripts/worker-process.ts` (long-running BullMQ worker), `src/app/api/jobs/route.ts`, `src/app/jobs/page.tsx` (live job status UI).
- **Schema:** `jobs.progressMessage` column added; worker writes per-topic progress ("Topic 3/7: Nuclear safety record").
- **`server-only` removed** from all `src/lib/` files — they must be importable by the standalone worker process. API route handlers and server actions retain it.

### Blockers/Concerns

- [Phase 1 readiness]: Entity map (CH number + alias list, e.g. SNC-Lavalin → AtkinsRéalis) must be human-confirmed for the initial 12 firms before research.
- [Phase 1 readiness]: Web-search vendor decision (Tavily vs Brave vs native) to be confirmed; keep behind a tool interface.
- [Cross-phase]: Companies House PSC is self-reported and does not trace foreign ultimate parents — corroborate ownership with AI research; never assert absence of contracts.
- [Phase 3 verification]: 7 browser-interaction items require human smoke testing before Phase 4 can begin (see 03-VERIFICATION.md).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-16T12:40:04.924Z
Stopped at: Phase 5 context gathered
Resume file: .planning/phases/05-consortium-recommender-initial-report/05-CONTEXT.md
