# Phase 5: Consortium Recommender + Initial Report - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 05-consortium-recommender-initial-report
**Areas discussed:** Recommender UI & flow, Scoring & ranking logic, Override UX (CONS-05), Initial report output

---

## Recommender UI & flow

### Where should the consortium recommender live?

| Option | Description | Selected |
|--------|-------------|----------|
| New /recommend page | Dedicated space: capability mix selector at top, recommendation result below. Clean separation from /analysis. Linked from sidebar nav. | ✓ |
| Panel on /analysis page | Add a 'Get Recommendation' section to the existing /analysis page, keeping all analytical tools together. | |
| Modal from dashboard | Trigger from a button on the main dashboard — recommendation appears in a dialog overlay. | |

**User's choice:** New /recommend page
**Notes:** Dedicated page gives a clean mental model and room for the weight sliders, lock section, and result cards.

---

### How should the capability mix input work on /recommend?

| Option | Description | Selected |
|--------|-------------|----------|
| Stepper counters per tag | Three +/− counters — Consultancy: 1, Infrastructure: 1, Nuclear: 1. Simple, compact, exactly maps to requirements. | ✓ |
| Checkboxes + count dropdowns | Checkbox to include each tag, then a count selector (0–3). More explicit but more UI. | |
| Natural-language preset cards | Pre-defined scenarios the user clicks. Fast but less flexible. | |

**User's choice:** Stepper counters per tag
**Notes:** Directly maps to the CapabilityTag enum in the type system.

---

### How is the recommendation computed — client-side or server-side?

| Option | Description | Selected |
|--------|-------------|----------|
| Server Action | Next.js Server Action reads DB and runs algorithm. No new API route needed. | |
| API route (/api/recommend) | Explicit REST endpoint. | ✓ |
| Client-side only | Load all data to client and compute in browser. | |

**User's choice:** API route (/api/recommend)
**Notes:** POST body includes capabilityMix, lockedFirmIds, and weights. Typed response for the recommendation result.

---

## Scoring & ranking logic

### Should the recommender produce one best answer or rank multiple alternatives?

| Option | Description | Selected |
|--------|-------------|----------|
| One primary + 2 alternatives | Primary shown prominently, 2 ranked alternatives below. Enables CONS-05 naturally. | ✓ |
| Single best answer only | One recommendation, no alternatives. | |
| Top-5 ranked list | Ranked table of up to 5 valid combinations. | |

**User's choice:** One primary recommendation + 2 alternatives
**Notes:** The alternatives list naturally supports the override/adjustment workflow.

---

### What secondary signals should influence ranking?

| Option | Description | Selected |
|--------|-------------|----------|
| Prior partnerships | Teams with partnership evidence score higher (partnershipPairs table). | ✓ |
| UK ownership / NSI | More UK-owned firms score higher (ownershipRecords table). | ✓ |
| Contract relevance | Stronger procurement history scores higher (procurementRecords table). | ✓ |
| Risk flags | Fewer/lower-severity risk flags score higher (riskFlags table). | ✓ |

**User's choice:** All four signals selected
**Notes:** All four signals are used. Weights are user-configurable.

---

### How should scoring weights be configured?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed equal weights, fully shown | Equal contribution, score breakdown always visible in reasoning panel. | |
| User-configurable weights | Sliders let user set signal weights before running. | ✓ |
| Hardcoded priority order | Signals applied as sequential filters, no numeric score. | |

**User's choice:** User-configurable weights
**Notes:** Sliders on /recommend. Default to 25/25/25/25. Reasoning panel shows score breakdown per firm per signal.

---

## Override UX (CONS-05)

### How does the user swap a firm out of the recommended team?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-slot replace picker | Each firm has a 'Replace' button showing alternatives in that category. | |
| Lock-and-recompute | User locks firms to keep, clicks 'Recompute' to find best remaining team. | ✓ |
| Promote from alternatives | User clicks an alternative team to promote it. | |

**User's choice:** Lock-and-recompute

---

### After recomputing, what analysis is shown inline?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline conflict badges | Capability tags, ownership badge, conflicts highlighted red, risk flag count — updates on recompute. | ✓ |
| Side panel with full analysis | Drawer showing conflict matrix filtered to recommended firms. | |
| Link to /analysis page | Navigate to /analysis with recommended firms highlighted. | |

**User's choice:** Inline conflict badges on the result

---

### How should pre-locking work before the initial computation?

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable 'Lock firms' section | Collapsible section below capability counters. User toggles locks before running. | ✓ |
| Inline firm picker at setup | Multi-select of firms above the counters. | |
| Post-result lock only | Lock only available after seeing the result. | |

**User's choice:** Expandable 'Lock firms' section (collapsed by default)
**Notes:** User explicitly wanted to be able to lock their own firm before running, e.g. "my firm is always in the recommendation."

---

## "Initial report" output

### What does the 'initial report' actually mean as an output?

| Option | Description | Selected |
|--------|-------------|----------|
| Populated dashboard = the report | No separate format; report is the dashboard state after running all 12×7. | |
| A dedicated /report page | New summary page rendering the recommendation output. | ✓ |
| Export to PDF/document | 'Download report' button generating a formatted PDF. | |

**User's choice:** A dedicated /report page

---

### What should the /report page show?

| Option | Description | Selected |
|--------|-------------|----------|
| Summary of all 12 firms + one sample recommendation | Firm grid + conflict summary + partnership evidence + sample recommendation. | |
| Full firm profiles in sequence | Combined print view of all 12 firm profiles. | |
| Just the recommendation output | /report shows the best 1+1+1 recommendation with reasoning and NSI flags. | ✓ |

**User's choice:** Just the recommendation output (best 1+1+1 for the seeded 12 firms)
**Notes:** The /report page is the end-to-end proof: if it renders correctly with a seeded database, the Phase 5 pipeline is proven.

---

## Claude's Discretion

- Exact layout of weight sliders (before counters, alongside, or in an "Advanced" accordion)
- Whether /report reuses the same recommendation card component as /recommend or uses a simplified print-friendly layout
- Tie-breaking logic for equally-scored combinations
- Error state rendering when insufficient firms exist for the requested capability mix

## Deferred Ideas

- Export to PDF/document (COLL-01 — v2 requirement)
- Network graph visualisation of firm relationships (VIS-01 — v2)
- Scheduled/automated refresh for the initial report (MON-01 — v2)
- Multi-signal weight presets ("NSI-first", "Partnership-first")
- Rename the tool "Partnerships" — product naming, deferred to milestone review
