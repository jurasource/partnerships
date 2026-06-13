# Firm Intelligence Dashboard

## What This Is

A configurable web dashboard that conducts deep research on a user-defined list of firms using AI-assisted web search and structured UK public procurement sources, then presents findings in an interactive, filterable interface. Built initially to support bid/consortium planning for UK civil nuclear and defence programmes, but designed to work with any set of firms and research topics.

## Core Value

Given a list of firms and research questions, surface the intelligence needed to decide which firms to team with and in what combination — in one place, without manual searching.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can define a list of firms with capability tags (Nuclear, Infrastructure, Consultancy)
- [ ] User can define a list of research topics to investigate per firm
- [ ] System researches each firm across all topics using AI web search + structured UK public sources (Contracts Finder, Find a Tender, Companies House)
- [ ] Research results are cached in a database; each firm can be manually refreshed
- [ ] Dashboard displays firm profiles with per-topic research findings
- [ ] Dashboard supports filtering firms by capability tag (Nuc / Infra / Cons)
- [ ] Dashboard surfaces cross-cutting analysis: ownership (UK vs non-UK), conflicts (audit/competitor relationships), and existing partnerships between firms
- [ ] Dashboard recommends optimal consortium compositions for a given capability mix (e.g. Cons + Infra + Nuc)
- [ ] Risk flags are surfaced per firm (e.g. financial, reputational, regulatory)
- [ ] Initial report generated from the 12 firms and 7 topics provided at project start

### Out of Scope

- Real-time financial data feeds / paid data sources — public domain only
- Classified or restricted procurement data — public sources only
- Multi-user accounts / permissions — single-user tool initially
- Automated scheduled refresh — manual refresh per firm is sufficient for v1

## Context

**Initial firms (12):**
- Nuclear + Infrastructure: Amentum, Atkins Realis, Frazer Nash, KBR
- Infrastructure: Nichols Group
- Infrastructure + Consultancy: Turner & Townsend
- Consultancy: Deloitte, EY, Newton, PA Consulting, PwC, Baringa

**Initial research topics (7):**
1. Notable capabilities of each firm
2. UK civil + defence contracts held
3. High risk firms and why
4. Conflicts between firms (audit relationships, direct competitors)
5. Best consortium combination for a bid needing Cons + Infra + Nuc
6. Which firms are not UK owned
7. Which firms currently work together

**UK public data sources to integrate:**
- Contracts Finder (UK government contracts)
- Find a Tender (UK procurement notices, formerly OJEU)
- Companies House (ownership, directors, group structure)
- General web / news search (reputation, partnerships, risk events)

**Domain context:**
- UK civil nuclear sector (NDA, Sellafield, new build, decommissioning) + UK defence (MOD programmes, defence nuclear)
- Consortia are common in this sector; firms frequently partner and also compete
- Audit relationships (Big 4 auditing other firms on the list) create conflicts of interest relevant to public sector bids

## Constraints

- **Data**: Public domain only — no paid APIs, no restricted data
- **Hosting**: Local-first for now; architecture should not preclude future cloud deployment
- **Research quality**: AI research must cite sources so findings are verifiable
- **Stack**: No preference stated — choose for speed of build and dashboard quality

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web dashboard over PDF/Word | User wants interactive filtering and reuse, not a static document | — Pending |
| Cache research results in DB | Research is slow/expensive; avoid re-running unless data has changed | — Pending |
| Both AI search + structured sources | Structured sources (Contracts Finder, Companies House) give verifiable data; AI fills gaps | — Pending |
| Configurable firms + topics | Tool must work beyond the initial 12 firms / 7 topics | — Pending |

---
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-13 after initialization*
