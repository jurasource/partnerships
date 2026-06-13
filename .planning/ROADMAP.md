# Roadmap: Firm Intelligence Dashboard

## Overview

The build follows the project's core architectural shape: a slow, multi-source research pipeline (write-side) feeding a fast, structured dashboard (read-side), with a SQLite cache as the single source of truth. We start by laying the trustworthy data foundation (schema, config store, entity map by Companies House number, UK API clients), then build the highest-risk research engine with citation enforcement and explicit "not found" output. Once findings exist, we surface them through firm profiles and a filterable comparison dashboard, layer in cross-cutting analysis (ownership, conflicts, partnerships, risk), and finish with the explainable consortium recommender — proven by running the seeded 12 firms x 7 topics end-to-end to produce the initial report.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Foundation** - Schema, config store, entity map, UK API clients + OCDS adapter, job-runner skeleton
- [ ] **Phase 2: Research Engine** - Per-(firm x topic) AI research loop with mandatory citations, "not found" output, and visible job status
- [ ] **Phase 3: Dashboard & Profiles** - Firm profiles, citation panel, capability filtering, sortable comparison table, refresh + staleness
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
- [ ] 01-PLAN-01.md — Walking Skeleton: Next.js + Drizzle/SQLite scaffold, full schema, seed (12 firms + 7 topics), sidebar shell, Firms list (DB read) + Add Firm dialog (DB write)
- [ ] 01-PLAN-02.md — Config CRUD: firm edit/delete, Topics CRUD, read-only Dashboard comparison table
- [ ] 01-PLAN-03.md — UK data layer: Companies House/Contracts Finder/Find a Tender clients, OCDS normalise+dedup adapter, SQLite job queue, per-firm refresh + Search CH
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 0/3 | Not started | - |
| 2. Research Engine | 0/TBD | Not started | - |
| 3. Dashboard & Profiles | 0/TBD | Not started | - |
| 4. Cross-Cutting Analysis | 0/TBD | Not started | - |
| 5. Consortium Recommender + Initial Report | 0/TBD | Not started | - |
