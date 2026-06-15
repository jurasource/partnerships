# Roadmap: Firm Intelligence Dashboard

## Overview

The build follows the project's core architectural shape: a slow, multi-source research pipeline (write-side) feeding a fast, structured dashboard (read-side), with a Postgres database as the single source of truth and a Redis-backed BullMQ queue dispatching work to a long-running worker process. We start by laying the trustworthy data foundation (schema, config store, entity map by Companies House number, UK API clients), then build the highest-risk research engine with citation enforcement and explicit "not found" output. Once findings exist, we surface them through firm profiles and a filterable comparison dashboard, layer in cross-cutting analysis (ownership, conflicts, partnerships, risk), and finish with the explainable consortium recommender — proven by running the seeded 12 firms x 7 topics end-to-end to produce the initial report.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Foundation** - Schema, config store, entity map, UK API clients + OCDS adapter, job-runner skeleton
- [x] **Phase 2: Research Engine** - Per-(firm x topic) AI research loop with mandatory citations, "not found" output, and visible job status (completed 2026-06-14)
- [x] **Phase 3: Dashboard & Profiles** - Firm profiles, citation panel, capability filtering, sortable comparison table, refresh + staleness (completed 2026-06-14)
- [ ] **Phase 4: Cross-Cutting Analysis** - Ownership chains, conflict/audit detection, partnership map, risk flags, recompute pass
- [ ] **Phase 5: Consortium Recommender + Initial Report** - Explainable rules-based recommender with conflict exclusion + NSI overlay, plus the seeded end-to-end report

## Phase Details

### Phase 1: Data Foundation

**Goal**: A trustworthy, configurable data layer exists — firms and topics are stored, every firm resolves to a verified Companies House number, and all three UK procurement/ownership APIs return normalised, deduped data into a single cache.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):

  1. User can add, edit, and remove firms (name, capability tags, Companies House number) and research topics via the UI
  2. On first run the app is pre-seeded with the initial 12 firms and 7 topics
  3. For a given firm, the system retrieves Companies House ownership/PSC data plus Contracts Finder and Find a Tender records, matched by Companies House number rather than name
  4. Contract and procurement records are normalised into one internal shape and deduped across Contracts Finder and Find a Tender
  5. Retrieved raw payloads and config persist in the local cache and survive an app restart

**Plans**: 3 plans
Plans:

- [x] 01-01-PLAN.md — Walking Skeleton: Next.js + Drizzle/SQLite scaffold, full schema, seed (12 firms + 7 topics), sidebar shell, Firms list (DB read) + Add Firm dialog (DB write) — COMPLETE 2026-06-13 (database since migrated to Postgres in db-worker-upgrade)
- [x] 01-02-PLAN.md — Config CRUD: firm edit/delete, Topics CRUD, read-only Dashboard comparison table — COMPLETE 2026-06-14
- [x] 01-03-PLAN.md — UK data layer: Companies House/Contracts Finder/Find a Tender clients, OCDS normalise+dedup adapter, SQLite job queue, per-firm refresh + Search CH — COMPLETE 2026-06-14

**UI hint**: yes

### Phase 2: Research Engine

**Goal**: AI-assisted research runs per (firm x topic) as a background job, producing verifiable, citation-carrying findings that clearly separate structured facts from AI narrative, with progress always visible and absence reported explicitly.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, RES-06, RES-07
**Success Criteria** (what must be TRUE):

  1. User can trigger research for a firm across all topics and watch progress update via job-status polling with no silent freezes
  2. Every AI-derived finding carries a mandatory source citation with the raw retrieved snippet, and verified structured-API data is visibly distinguished from AI narrative
  3. When nothing is found, the result is an explicit "not found" with a reason — never empty silence
  4. Research results are cached and only re-run on a manual user trigger, with a visible "last researched" timestamp and staleness indicator per firm

**Plans**: 3 plansPlans:
**Wave 1**

- [x] 02-01-PLAN.md — Search client + Finding schema + grounding/prompts + citation-enforced research worker (RES-03/04/05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — runResearch action + /api/research/run worker route + status polling endpoint + lastResearchedAt (RES-01/02/06/07)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Research trigger button, job status badge, N/7 progress, staleness badge wired into the firms table (RES-01/02/07)

**UI hint**: yes

### Phase 3: Dashboard & Profiles

**Goal**: Users can read every firm's research findings in one place — a per-firm profile aggregating findings by topic with a clear citation panel and UK contract history, plus a cross-firm comparison table they can filter, sort, and refresh.
**Mode:** mvp
**Depends on**: Phase 2 (can begin against seeded data)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-06, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):

  1. User can open a firm profile that aggregates all research findings by topic, shows its capability tags, and shows UK contract history (titles, dates, values, sources)
  2. The profile's citation panel clearly distinguishes structured API data from AI-derived findings
  3. User can view a cross-firm comparison table and filter it by capability tag (Nuc/Infra/Cons) and sort it by any column
  4. User can trigger a research refresh for any firm directly from the dashboard

**Plans**: 2 plans (Wave 1 — parallel, no file overlap)
Plans:

- [x] 03-01-PLAN.md — Firm profile slice: /firms/[id] route, getFirmProfile query, findings-by-topic tabs, citation panel, contract history table, profile refresh (PROF-01/02/03/06)
- [x] 03-02-PLAN.md — Comparison dashboard slice: getComparisonRows query, extended filterable/sortable comparison table, capability filter bar, firm-name profile links, per-row refresh (DASH-01/02/03/04)

**UI hint**: yes

### Phase 03.1: Firm Groups (INSERTED)

**Goal:** Users can organise firms into named groups (many-to-many), manage group membership from a dedicated groups page, see group membership as clickable pills in the firms table, and filter the firms table by group, capability, and research status from a unified top-level filter bar.
**Requirements**: GRP-01, GRP-02, GRP-03, GRP-04, GRP-05
**Depends on:** Phase 3
**Mode:** mvp
**Plans:** 2/3 plans executed

Plans:

**Wave 1**

- [x] 03.1-01-PLAN.md — Data layer: groups + firmGroups tables, Group/FirmGroup types, group CRUD + membership server actions, [BLOCKING] drizzle-kit push (GRP-01/02/03)

**Wave 2** *(blocked on Wave 1; both run in parallel — no file overlap)*

- [x] 03.1-02-PLAN.md — Groups management UI: Groups nav item, /groups list + create/delete, /groups/[id] inline rename + add/remove member firms (GRP-01/02/04) — COMPLETE 2026-06-15
- [ ] 03.1-03-PLAN.md — Firms table groups pills + unified filter bar (groups/capabilities/research status), firms RSC query extension (GRP-04/05)

**UI hint**: yes

### Phase 4: Cross-Cutting Analysis

**Goal**: The dashboard surfaces the relationships between firms — ownership nationality and parent chains, conflicts of interest (audit + competitor) with sourced evidence, existing partnerships, and risk flags — all materialised as recomputable records that refresh when any firm is refreshed.
**Mode:** mvp
**Depends on**: Phase 3 (needs >=2 firms researched)
**Requirements**: PROF-04, PROF-05, PROF-07, ANAL-01, ANAL-02, ANAL-03, ANAL-04
**Success Criteria** (what must be TRUE):

  1. Each firm profile shows ownership structure (UK-incorporated status, ultimate parent, country of ownership, source) and ownership nationality appears prominently on profiles and in the comparison table
  2. The system flags conflicts of interest between firm pairs (audit relationships and direct competitors) with sourced evidence rather than auto-asserted conclusions
  3. The system identifies which firms work or have worked together (co-supplier awards, announced JVs), and profiles show collaboration history and cultural-fit signals
  4. Each firm shows risk flags (financial, reputational, regulatory) with severity and dated sources
  5. Cross-cutting analysis results recompute when any firm is refreshed

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Schema (5 tables + jobs.jobType) + ownership/risk-flag extraction + [BLOCKING] schema push (PROF-04/05, ANAL-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — Conflict/partnership/collaboration extraction + co-supplier SQL + cross-cutting BullMQ job chaining (ANAL-01/02/04, PROF-07)

**Wave 3** *(blocked on Wave 2)*

- [x] 04-03-PLAN.md — Firm profile sections + sortable Ownership column on comparison table (PROF-04/05/07, ANAL-01/02/03)

**Wave 4** *(blocked on Wave 3)*

- [ ] 04-04-PLAN.md — /analysis page (ownership roll-up, conflict matrix, partnership table) + sidebar nav + /jobs labels (ANAL-01/02/03, PROF-07)

**UI hint**: yes

### Phase 5: Consortium Recommender + Initial Report

**Goal**: Users get an explainable, rules-based consortium recommendation for a requested capability mix that automatically excludes conflicted firm pairs and surfaces foreign-ownership/NSI considerations — and the whole pipeline is proven by running the seeded 12 firms x 7 topics end-to-end to produce the initial report.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: CONS-01, CONS-02, CONS-03, CONS-04, CONS-05
**Success Criteria** (what must be TRUE):

  1. User can request a consortium recommendation for a specified capability mix (e.g. one each of Cons, Infra, Nuc)
  2. The recommendation explains its reasoning (capability coverage, conflict exclusions, contract relevance) and automatically excludes firm pairs with flagged conflicts
  3. The recommendation surfaces foreign-ownership and NSI considerations for each recommended firm
  4. User can override or adjust recommended firms and see updated conflict/capability analysis
  5. Running the seeded 12 firms x 7 topics end-to-end produces the initial report

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 3/3 | Complete | 2026-06-14 |
| 2. Research Engine | 3/3 | Complete   | 2026-06-14 |
| 3. Dashboard & Profiles | 2/2 | Complete   | 2026-06-14 |
| 3.1 Firm Groups | 2/3 | In Progress|  |
| 4. Cross-Cutting Analysis | 3/4 | In Progress|  |
| 5. Consortium Recommender + Initial Report | 0/TBD | Not started | - |
