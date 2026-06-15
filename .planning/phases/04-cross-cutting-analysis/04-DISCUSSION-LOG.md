# Phase 4: Cross-Cutting Analysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 4-Cross-Cutting Analysis
**Areas discussed:** Facts extraction strategy, Cross-firm UI surface, Ownership tracing depth, Recompute trigger scope

---

## Folded Todos

| Todo | Folded? | Notes |
|------|---------|-------|
| View firm refresh results after data pull | No | Partially met by Phase 4 profile additions; full CH panel in edit dialog deferred |
| Name this tool "Partnerships" | No | Product naming decision, deferred to milestone review |
| CH number as external link to Companies House | ✓ | Folds naturally into PROF-04 ownership section on firm profile |

---

## Facts Extraction Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Re-process existing findings | Second LLM pass reads cached topic 3/4/6/7 findings; no new Tavily calls | ✓ |
| New dedicated research sub-tasks | New per-firm research jobs for cross-cutting (uses ~48 more Tavily searches) | |

**User's choice:** Re-process existing findings
**Notes:** Works entirely from the research cache. No extra Tavily quota consumed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip and surface "not analysed" state | Leave records empty; show prompt to run research first | ✓ |
| Trigger research job automatically | Enqueue research before extracting for un-researched firms | |
| You decide | Leave to implementer | |

**User's choice:** Skip — surface "not analysed" state
**Notes:** Clean and honest. No implicit side-effects on a read-like analysis pass.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Audit relationships + direct competitors | Both, AI-extracted from topic-4 finding | ✓ |
| Audit relationships only | Scope narrowed to verifiable audit relationships | |
| You decide | Leave to implementer | |

**User's choice:** Audit relationships + direct competitors, AI-extracted from findings

---

## Cross-Firm UI Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Each firm's profile page only | Pairs surfaced per firm from that firm's perspective; no new page | |
| New /analysis page with matrix view | Dedicated route with conflict matrix + partnership summary + ownership roll-up | ✓ |
| Tab on existing comparison dashboard | "Relationships" tab added to /dashboard | |

**User's choice:** New /analysis page

---

| Option | Description | Selected |
|--------|-------------|----------|
| Conflict matrix + partnership summary + ownership nationality roll-up | Three sections on the analysis page | ✓ |
| Conflict matrix only | Minimal — conflicts only | |
| You decide | Leave to implementer | |

**User's choice:** All three sections on /analysis

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — profiles show both | Firm profile shows ownership, risk flags, collaboration history, AND conflicts/partnerships from that firm's perspective | ✓ |
| No — /analysis only for cross-firm data | Profiles only show that firm's own data | |

**User's choice:** Yes — profiles show both

---

## Ownership Tracing Depth

| Option | Description | Selected |
|--------|-------------|----------|
| CH PSC first-level + topic-6 finding corroboration | Immediate PSC from CH + AI finding for ultimate parent context; flag when untraceable | ✓ |
| CH PSC first-level only | Structured data only, no AI corroboration | |
| CH PSC + recursive CH lookup for UK-registered parents | Additional CH calls for UK-registered parent entities | |

**User's choice:** CH PSC first-level + topic-6 corroboration
**Notes:** Flag "ultimate parent not publicly traceable via CH" for foreign corporate PSCs.

---

| Option | Description | Selected |
|--------|-------------|----------|
| New "Ownership" column: UK-owned flag + parent country badge | Colour-coded badge (green = UK, amber = foreign), sortable | ✓ |
| Tooltip on firm name only | No new column — ownership in hover tooltip | |
| You decide | Leave to implementer | |

**User's choice:** New "Ownership" column in comparison table

---

## Recompute Trigger Scope

| Option | Description | Selected |
|--------|-------------|----------|
| That firm's records + all pairs involving it | Recomputes firm's own records + all A-related conflict/partnership pairs | |
| That firm's own records only | Pairs only update when both firms are refreshed | |
| Full recompute across all firms on every refresh | Any refresh triggers full cross-cutting pass | |
| Separate job triggered by research worker completion | Research worker enqueues a `cross-cutting-analysis` BullMQ job | ✓ |

**User's choice:** Separate BullMQ job enqueued by research worker on completion
**Notes:** The cross-cutting job recomputes firm's own records + all pairs involving it. Decoupled from research job. Appears in /jobs UI.

---

## Claude's Discretion

- Co-supplier detection implementation (SQL query finding shared `ocid` across firm `supplierChNumber` values) — left to implementer.
- Schema design for new derived record tables (`ownership_records`, `conflict_pairs`, `partnership_pairs`, `risk_flags`) — left to implementer, guided by constraints in CONTEXT.md.
- Conflict matrix visual design (red/amber cell highlighting) — left to implementer within Phase 3 design system.

## Deferred Ideas

- "Name this tool 'Partnerships'" — product naming, deferred to milestone review.
- Recursive CH parent chain lookup for foreign ultimate parents — v2 enhancement.
- SSE/streaming for cross-cutting job progress — polling sufficient for v1.
- "Discover unlisted firms with relevant capabilities" — new capability, separate phase.
- "Consortium analysis firm selection and named groups" — Phase 5 scope.
