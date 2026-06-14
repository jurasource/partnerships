# Feature Landscape

**Domain:** Firm intelligence / competitive intelligence dashboard for UK public-sector bid & consortium planning (civil nuclear + defence)
**Researched:** 2026-06-13
**Overall confidence:** MEDIUM-HIGH

## Context

This is not a generic competitive-intelligence (CI) tool. It sits at the intersection of three established commercial product categories, each of which contributes a feature vocabulary:

1. **Competitive intelligence / company profiling** (Valona, Veridion, Sedulo) — competitor profiles, battlecards, news monitoring.
2. **Third-party risk management (TPRM) / supplier due diligence** (Exiger, LexisNexis Nexis Diligence+, Sphera, EcoVadis, LSEG) — risk scoring, adverse media, sanctions, financial health, beneficial ownership.
3. **Relationship intelligence** (Altrata, Affinity, Coresignal) — company-to-company ties via deals, partnerships, shared investors, executive movement, and network graphs.

The project's differentiator is the **consortium-planning lens**: combining (1)+(2)+(3) and adding UK-procurement-specific overlays (Contracts Finder / Find a Tender contract history, Companies House ownership, audit conflict-of-interest detection) to answer *"who should team with whom for a Cons + Infra + Nuc bid?"*. Generic tools answer "is this supplier risky?"; this tool answers "what is the best bid team and what blocks it?".

The 7 research topics in PROJECT.md map directly onto features below — they are the must-have outputs, not aspirations.

---

## Table Stakes

Features users expect. Missing = the dashboard feels like a list of notes rather than an intelligence tool. These map closely to the 7 mandated research topics.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Firm profile page** (per-firm view aggregating all topics) | Core unit of the product; every CI/due-diligence tool is built around a company profile | Low | One page per firm; sections = research topics. Maps to Topic 1 (notable capabilities). |
| **Capability tagging + filter** (Nuc / Infra / Cons) | User explicitly needs to assemble a capability mix; filtering is the primary navigation | Low | Tags drive both filtering and consortium logic. Already in Active requirements. |
| **Per-topic research findings with cited sources** | Constraint: AI findings must be verifiable. Untraceable claims are worthless in a procurement context | Medium | Each finding needs a source URL + retrieval date. This is the single most important quality feature. |
| **UK contract history per firm** (civil + defence) | Topic 2; the evidence base for "can this firm actually deliver in this sector" | Medium-High | Pull from Contracts Finder + Find a Tender (OCDS/JSON APIs, free, no auth). Match firms via Companies House number, not name, to avoid false matches. |
| **Ownership / nationality flag** (UK vs non-UK) | Topic 6; directly relevant to defence/nuclear bids where foreign ownership triggers scrutiny (NSI Act, security clearances) | Medium | Companies House PSC (persons with significant control) data + parent-company lookup. Several initial firms are foreign-owned (e.g. KBR US, Amentum US, AtkinsRéalis Canada). |
| **Per-firm risk flags** (financial / reputational / regulatory) | Topic 3; standard across all TPRM tools. A firm-intel tool without risk is just a directory | Medium | Categorise flags; show severity. Sources: adverse media, Companies House financials/filings, sanctions/debarment lists. |
| **Manual refresh per firm** | PROJECT decision; research is slow/expensive, results cached in DB | Low-Medium | Show "last researched" timestamp so staleness is visible. |
| **Cross-firm comparison view** | Users decide *between* firms; a profile-only tool forces mental juggling | Medium | Sortable table: firm × (capabilities, contracts, ownership, risk). The natural "home" screen. |
| **Source/citation panel** | Verifiability constraint; auditability matters in public-sector decisions | Low-Medium | Every claim links to its source. Distinguish structured-source facts (high confidence) from AI/web findings (lower). |

---

## Differentiators

Features that make *this* tool genuinely useful for consortium planning — beyond what a generic CI or TPRM product gives you. These are where the project earns its keep.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Conflict-of-interest detection** (audit relationships + direct competitors) | Topic 4; the standout feature. In UK public procurement, COI is a statutory duty (Procurement Act 2023). Big 4 auditing other firms on the list is a real, bid-relevant conflict | High | Two sub-types: (a) audit/advisory relationships (e.g. a Big 4 firm audits a prospective partner), (b) direct-competitor overlap (two firms competing for the same role). Hard to fully automate — combine structured signals (auditor disclosed in Companies House accounts) with AI reasoning. Flag, don't auto-conclude. |
| **Consortium recommendation engine** | Topic 5; the headline use case. Recommends optimal team combos for a required capability mix (Cons + Infra + Nuc) | High | Logic: cover the capability matrix with minimum overlap, then penalise combos that trigger COI flags or include high-risk firms, and favour firms with proven joint delivery. Start rules-based and explainable; avoid black-box scoring. |
| **Existing-partnership / "who works together" map** | Topic 7; relationship-intelligence overlay. Knowing two firms already deliver together de-risks a consortium | Medium-High | Derive from shared contract awards (same Contracts Finder notice), announced JVs/alliances (news), and framework lots. A simple network graph (nodes = firms, edges = past collaboration) is high-impact and demos well. |
| **Conflict-aware consortium scoring** | Combines COI + partnership + risk into "is this a viable, clean team?" | High | The synthesis layer that no off-the-shelf tool offers because none know your specific firm shortlist. This is the actual product thesis. |
| **Foreign-ownership / NSI-sensitivity overlay on consortium view** | Defence/nuclear bids weight UK control heavily; surfacing it at team-selection time is a real edge | Medium | Visual flag on each recommended team showing UK-controlled vs foreign-owned composition. |
| **Configurable firms + topics** | PROJECT requirement; lets the tool be reused for any firm set / question set, not just the initial 12/7 | Medium | Topics as user-defined research prompts; firms as user-defined list with tags. Generalises the tool beyond v1. |
| **Sector-specific contract context** (NDA, Sellafield, MOD, defence nuclear) | Generic tools treat all contracts equally; weighting civil-nuclear / defence-nuclear relevance is domain value | Medium | Tag contracts by programme/buyer to show *relevant* track record, not just total contract count. |

---

## Anti-Features

Things to deliberately NOT build in v1. Each is either out of scope per PROJECT.md, a complexity trap, or a credibility risk.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|--------------------|
| **Real-time / paid financial data feeds** (Orbis, D&B, LSEG) | Explicitly out of scope; public-domain-only constraint; expensive | Use free Companies House filings + AI summary of published accounts. |
| **Automated scheduled refresh / continuous monitoring** | Out of scope for v1; adds infra + rate-limit complexity | Manual per-firm refresh with visible "last updated" timestamp. |
| **Multi-user accounts / roles / permissions** | Out of scope; single-user tool initially | Single local user; design DB so multi-tenant is *possible* later, but build none of it now. |
| **Auto-asserted COI/risk conclusions without human review** | A wrong "Firm X has a conflict" claim is reputationally and legally damaging in procurement | Surface *flags with evidence* and let the user judge. Never present low-confidence AI inference as fact. |
| **Sanctions/AML screening engine** | Looks adjacent but is a regulated, false-positive-heavy specialty; out of scope for these blue-chip UK firms | Capture sanctions/debarment only if it surfaces in adverse-media research; don't build a screening pipeline. |
| **Battlecards / sales-enablement features** | Borrowed from CI tools but irrelevant to consortium planning | Skip entirely. |
| **Generic web-crawler/scraper for arbitrary sites** | Brittle, maintenance-heavy, legally grey | Use the structured UK APIs (OCDS, Companies House) + a constrained AI web-search tool with citations. |
| **Predictive ML scoring of "bid win probability"** | Insufficient data, unexplainable, over-promises | Explainable rules-based consortium scoring the user can audit. |

---

## Feature Dependencies

```
Firm profile + capability tags        (foundation — build first)
        │
        ├──► Contract history (Contracts Finder / Find a Tender)
        │            │
        │            └──► Existing-partnership map (shared awards)
        │                          │
        ├──► Ownership/nationality (Companies House PSC) ──┐        │
        │                                                   │        │
        ├──► Risk flags (adverse media + filings)           │        │
        │                                                   ▼        ▼
        └──► Conflict-of-interest detection ──────► Consortium recommendation engine
                                                    (needs: tags + COI + partnerships + risk + ownership)
```

The consortium engine is the capstone — it consumes nearly every other feature, so the foundational data features must land first and be reliable before the recommendation layer is meaningful.

---

## MVP Recommendation

Prioritise (in build order):

1. **Firm profile + capability tags + cross-firm comparison table** — the skeleton everything hangs on (Topic 1).
2. **Per-topic AI research with cited sources** — the verifiable evidence engine; the quality bar of the whole tool.
3. **UK contract history** via Contracts Finder / Find a Tender (Topic 2) — highest-value structured data, free APIs.
4. **Ownership flag + risk flags** (Topics 3, 6) — structured Companies House + adverse-media research.
5. **One differentiator: conflict-of-interest detection** (Topic 4) — the most defensible, demo-worthy feature.

Then, once the data layer is trustworthy:

6. **Existing-partnership map + consortium recommendation** (Topics 5, 7) — the capstone payoff.

**Defer:**
- Consortium recommendation *engine* until the underlying data (contracts, COI, partnerships) is reliable — a recommendation built on shaky data is worse than none.
- Network-graph visualisation until partnership data exists; start with a simple "works-with" list, upgrade to a graph if time allows.
- Generalisation polish (arbitrary firms/topics) — the architecture should support it from day one, but tune against the known 12 firms / 7 topics first.

---

## UK Procurement / Consortium Considerations (for downstream requirements)

- **Conflict of interest is a statutory duty** under the Procurement Act 2023 — the COI feature is not a nice-to-have for this audience, it mirrors a real obligation bidders manage.
- **Match firms by Companies House number, not name** — "Atkins", "AtkinsRéalis", "SNC-Lavalin" are the same group; name-only matching will fragment or merge firms incorrectly.
- **Foreign ownership is decision-relevant** in defence/nuclear — surface it prominently, not buried. Several initial firms are non-UK owned (KBR, Amentum — US; AtkinsRéalis — Canada).
- **Confidence tiering matters**: structured-source facts (contract awards, registered ownership) = high confidence; AI/news-derived findings (risk, partnerships, conflicts) = clearly flagged as lower confidence and cited.

---

## Sources

- Valona Intelligence — competitive intelligence dashboards: https://valonaintelligence.com/market-intelligence-software/competitive-intelligence-dashboard (MEDIUM — vendor)
- Veridion — competitive intelligence tools: https://veridion.com/blog-posts/competitive-intelligence-tools/ (MEDIUM — vendor)
- Exiger — due diligence solutions: https://www.exiger.com/due-diligence-solutions/ (MEDIUM — vendor)
- LexisNexis Nexis Diligence+ — enhanced due diligence: https://www.lexisnexis.com/en-us/products/nexis-diligence-plus.page (MEDIUM — vendor)
- Sphera — Supplier 360 Intelligence: https://sphera.com/solutions/supply-chain-risk-management/supplier-intelligence-solution/ (MEDIUM — vendor)
- LSEG — supply chain risk / sanctions screening: https://www.lseg.com/en/risk-intelligence/third-party-risk-management/supply-chain (MEDIUM — vendor)
- Altrata — relationship mapping / intelligence: https://altrata.com/articles/what-is-relationship-mapping (MEDIUM — vendor)
- Coresignal — relationship intelligence (company-to-company ties): https://coresignal.com/blog/relationship-intelligence/ (MEDIUM — vendor)
- UK Cabinet Office PPN — managing conflicts of interest in procurement: https://assets.publishing.service.gov.uk/media/6139d837e90e070434bbbfc0/20210909-PPN-04_21-A-Guide-for-Commercial-and-Procurement-Professionals-Updated-version.pdf (HIGH — official UK gov)
- ICLG — Public Procurement Laws (England & Wales) incl. Procurement Act 2023: https://iclg.com/practice-areas/public-procurement-laws-and-regulations/england-and-wales (HIGH — legal reference)
- GOV.UK — Open Contracting / Contracts Finder OCDS data: https://www.gov.uk/government/publications/open-contracting (HIGH — official)
- Open Contracting Partnership — UK Contracts Finder data registry: https://data.open-contracting.org/en/publication/128 (HIGH — standards body)
- Tussell — 2025 Analysis of UK Government Strategic Suppliers: https://www.tussell.com/insights/uk-government-strategic-suppliers (MEDIUM — analyst)
