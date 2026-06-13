# Requirements: Firm Intelligence Dashboard

**Defined:** 2026-06-13
**Core Value:** Given a list of firms and research questions, surface the intelligence needed to decide which firms to team with and in what combination — in one place, without manual searching.

## v1 Requirements

### Configuration

- [x] **CONF-01**: User can add a firm with name, capability tags (Nuc/Infra/Cons), and Companies House number via the UI
- [ ] **CONF-02**: User can edit firm details (name, tags, Companies House number)
- [ ] **CONF-03**: User can remove a firm from the list
- [ ] **CONF-04**: User can add a research topic to be investigated per firm
- [ ] **CONF-05**: User can edit or remove a research topic
- [x] **CONF-06**: System pre-seeds the initial 12 firms and 7 topics on first run

### Research Engine

- [ ] **RES-01**: User can trigger AI-assisted research for a firm across all topics
- [ ] **RES-02**: Research progress is visible in the UI via job-status polling (no silent freezes)
- [ ] **RES-03**: Each AI-derived finding includes mandatory source citations with raw retrieved snippet
- [ ] **RES-04**: Findings distinguish verified structured data (from UK APIs) from AI-derived narrative
- [ ] **RES-05**: Explicit "not found" is a first-class output — silence is never returned without a reason
- [ ] **RES-06**: Research results are cached in a local database; re-research only on manual user trigger
- [ ] **RES-07**: Each firm shows a "last researched" timestamp and a staleness indicator

### UK Data Integration

- [ ] **DATA-01**: System queries Contracts Finder for published UK contracts per firm
- [ ] **DATA-02**: System queries Find a Tender for published UK procurement notices per firm
- [ ] **DATA-03**: System queries Companies House for ownership/PSC data per firm
- [ ] **DATA-04**: Firms are matched to procurement records by Companies House number (not name alone)
- [ ] **DATA-05**: Contract and procurement data is deduped across Contracts Finder and Find a Tender

### Firm Profiles

- [ ] **PROF-01**: Each firm has a profile page aggregating all research findings by topic
- [ ] **PROF-02**: Profile shows a source/citation panel clearly distinguishing structured API data from AI findings
- [ ] **PROF-03**: Profile shows UK contract history (titles, dates, values, sources) from procurement APIs
- [ ] **PROF-04**: Profile shows ownership structure: UK-incorporated status, ultimate parent company, country of ownership, and source
- [ ] **PROF-05**: Profile shows risk flags (financial, reputational, regulatory) with severity level and dated sources
- [ ] **PROF-06**: Profile shows capability tags (Nuc/Infra/Cons)
- [ ] **PROF-07**: Profile shows collaboration history and cultural fit indicators: prior joint delivery evidence (shared contracts/JVs) and org culture signals (size, public-sector focus, partnership vs competitive stance)

### Dashboard

- [ ] **DASH-01**: Dashboard shows a cross-firm comparison table with all firms and their capability tags
- [ ] **DASH-02**: User can filter the comparison table by capability tag (Nuc/Infra/Cons)
- [ ] **DASH-03**: User can sort the comparison table by any column
- [ ] **DASH-04**: User can manually trigger a research refresh for any firm from the dashboard

### Cross-Cutting Analysis

- [ ] **ANAL-01**: System detects and flags conflicts of interest between pairs of firms — audit relationships and direct competitor relationships — with sourced evidence (not auto-asserted conclusions)
- [ ] **ANAL-02**: System identifies which firms currently work or have worked together, based on co-supplier awards and announced JVs
- [ ] **ANAL-03**: Ownership nationality (and foreign ultimate parent chain where detectable) is surfaced prominently on firm profiles and in the comparison table
- [ ] **ANAL-04**: Cross-cutting analysis results are recomputed when any firm is refreshed

### Consortium Recommendation

- [ ] **CONS-01**: User can request a consortium recommendation for a specified capability mix (e.g. one each of Cons, Infra, Nuc)
- [ ] **CONS-02**: Recommendation is rules-based and explains its reasoning — capability coverage, conflict exclusions, contract relevance — not a black box
- [ ] **CONS-03**: Recommendation automatically excludes firm pairs with flagged conflicts of interest
- [ ] **CONS-04**: Recommendation surfaces foreign ownership and NSI (National Security and Investment) considerations for each recommended firm
- [ ] **CONS-05**: User can override or adjust recommended firms and see updated conflict/capability analysis

## v2 Requirements

### Visualisation

- **VIS-01**: Network graph visualisation of firm relationships, partnerships, and conflicts (React Flow)
- **VIS-02**: Timeline view of firms' UK contract history

### Monitoring

- **MON-01**: Scheduled refresh — re-research firms automatically on a configured interval
- **MON-02**: Alert when a firm's risk status or key data changes significantly

### Collaboration

- **COLL-01**: Export report to PDF or Word document
- **COLL-02**: Share a read-only link to a consortium recommendation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Paid financial data feeds | Public domain only — no paid APIs in v1 |
| Multi-user accounts / permissions | Single-user tool; no auth system needed |
| Auto-asserted COI or risk conclusions | Must show sourced evidence; the tool surfaces leads, not verdicts |
| Sanctions / AML screening | Specialised legal product; out of scope for this tool |
| Predictive bid win probability (ML) | Would require training data we don't have; recommendation is rules-based |
| Web scraping of GOV.UK pages | Use the official APIs (Contracts Finder, Find a Tender, Companies House) |
| Classified or restricted procurement data | Public domain only |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONF-01 | Phase 1 | Complete (Plan 01-01) |
| CONF-02 | Phase 1 | Pending |
| CONF-03 | Phase 1 | Pending |
| CONF-04 | Phase 1 | Pending |
| CONF-05 | Phase 1 | Pending |
| CONF-06 | Phase 1 | Complete (Plan 01-01) |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| RES-01 | Phase 2 | Pending |
| RES-02 | Phase 2 | Pending |
| RES-03 | Phase 2 | Pending |
| RES-04 | Phase 2 | Pending |
| RES-05 | Phase 2 | Pending |
| RES-06 | Phase 2 | Pending |
| RES-07 | Phase 2 | Pending |
| PROF-01 | Phase 3 | Pending |
| PROF-02 | Phase 3 | Pending |
| PROF-03 | Phase 3 | Pending |
| PROF-06 | Phase 3 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| PROF-04 | Phase 4 | Pending |
| PROF-05 | Phase 4 | Pending |
| PROF-07 | Phase 4 | Pending |
| ANAL-01 | Phase 4 | Pending |
| ANAL-02 | Phase 4 | Pending |
| ANAL-03 | Phase 4 | Pending |
| ANAL-04 | Phase 4 | Pending |
| CONS-01 | Phase 5 | Pending |
| CONS-02 | Phase 5 | Pending |
| CONS-03 | Phase 5 | Pending |
| CONS-04 | Phase 5 | Pending |
| CONS-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38 (100%) ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-13*
*Last updated: 2026-06-13 after roadmap creation*
