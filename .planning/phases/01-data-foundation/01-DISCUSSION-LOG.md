# Phase 1: Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 1-Data Foundation
**Areas discussed:** Todo: Citations, CH number lookup UX, Config UI navigation, Job-runner durability, OCDS dedup strategy

---

## Todo: Citations

| Option | Description | Selected |
|--------|-------------|----------|
| Design it in Phase 1 | Add citation/confidence fields to the DB schema now so Phase 2 just writes into an existing structure. Avoids a schema migration mid-build. | ✓ |
| Leave it to Phase 2 | Phase 1 only does config + API clients. Phase 2 owns its own schema. Keeps Phase 1 scope tight. | |
| Fold the whole todo | Capture the citation requirement as a cross-cutting constraint in CONTEXT.md (not implemented in Phase 1, but flagged for Phase 2 and Phase 4). | |

**User's choice:** Design it in Phase 1
**Notes:** Citation/confidence fields (`source_url`, `source_title`, `raw_snippet`, `confidence`) go into the Phase 1 `findings` table schema. The enforcement behaviour (no unsourced claims) is Phase 2 work.

---

## CH Number Lookup UX

### Question 1: How should a user provide the CH number for a new firm?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual entry only | User types the CH number directly. Simple. | |
| UI search + confirm | Searches Companies House, shows results, user picks one. CH number auto-fills. | |
| Optional search | Manual entry is primary; a 'Search CH' button opens a lookup panel. | ✓ |

**User's choice:** Optional search
**Notes:** Power users who know the CH number can type it directly; others can use the search button.

### Question 2: How should the initial 12 firms be seeded?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-code in seed file | Pre-verified CH numbers in a TypeScript seed file. No UI step. | |
| First-run wizard | App prompts user to confirm each firm's CH number on first run. | |
| Seed + editable via UI | Hard-code in seed file, but allow corrections via config UI. | ✓ |

**User's choice:** Seed + editable via UI
**Notes:** Fast first run, but CH numbers are correctable if the seed is wrong.

---

## Config UI Navigation

### Question 1: Top-level navigation structure

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard + Settings routes | Two top-level routes. Clear separation. | |
| Single page with tabs | One page with tab switcher. | |
| Sidebar nav | Persistent left sidebar with links: Dashboard, Firms, Topics (and later: Analysis, Consortium). | ✓ |

**User's choice:** Sidebar nav
**Notes:** Scales better as Phases 3–5 add new views.

### Question 2: Firm edit UI location

| Option | Description | Selected |
|--------|-------------|----------|
| Modal / dialog | shadcn Dialog with the form. | ✓ |
| Slide-over panel | shadcn Sheet component, right-side panel. | |
| Inline row editing | Edit fields appear inline in the table row. | |

**User's choice:** Modal / dialog

### Question 3: Landing page

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard (firm list) | Land on the comparison table. | ✓ |
| Firms config | Land on firm management page. | |
| You decide | Claude picks. | |

**User's choice:** Dashboard (firm list)

---

## Job-Runner Durability

### Question 1: Queue durability model

| Option | Description | Selected |
|--------|-------------|----------|
| In-process async | Jobs run as async tasks in Next.js process. Lost on restart. | |
| SQLite-backed queue | Job records in SQLite. Survives restart; always queryable. | ✓ |
| You decide | Claude picks. | |

**User's choice:** SQLite-backed queue

### Question 2: Job record schema scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: status + timestamps | id, firm_id, topic_id (nullable), status, created_at, started_at, completed_at, error_message. | ✓ |
| Full audit trail | Also: duration_ms, retry_count, raw error stack, triggered_by. | |
| You decide | Claude picks. | |

**User's choice:** Minimal: status + timestamps

---

## OCDS Dedup Strategy

### Question 1: When to deduplicate

| Option | Description | Selected |
|--------|-------------|----------|
| At write time — upsert on notice ID | Upsert keyed on OCDS `ocid`. One record per notice, source provenance as a column. | ✓ |
| At query time — aggregate view | Store all raw payloads as-is; deduplicate in SQL view or app layer. | |
| You decide | Claude picks. | |

**User's choice:** At write time — upsert on notice ID

### Question 2: Raw vs normalised storage

| Option | Description | Selected |
|--------|-------------|----------|
| Store both: raw blob + normalised columns | Normalised columns for querying; raw JSON blob for auditability. | ✓ |
| Normalised columns only | Lighter DB; re-fetching needed if raw data required. | |
| Raw blob only | Parse on every read. Slow queries. | |

**User's choice:** Store both: raw blob + normalised columns

---

## Claude's Discretion

- Sidebar collapsibility (nice-to-have) — planner decides if implementation complexity is worth it.

## Deferred Ideas

None — discussion stayed within Phase 1 scope. Citation enforcement behaviour deferred to Phase 2.
