# Phase 5: Consortium Recommender + Initial Report - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers an explainable, rules-based consortium recommender that reads conflict, ownership, partnership, and risk data already persisted by Phase 4, plus a dedicated `/report` page that displays the best consortium recommendation for the seeded 12-firm dataset.

- **`/recommend` page**: capability-mix input (stepper counters per tag), optional firm pre-locking, scoring weight configuration, primary recommendation + 2 alternatives, lock-and-recompute override pattern, inline conflict/ownership/risk badges per recommended firm.
- **`/api/recommend` route**: server-side rules-based algorithm that scores and ranks valid firm combinations against the 4 secondary signals, returning typed recommendation objects.
- **`/report` page**: shows the best 1+1+1 consortium recommendation for the seeded firms (with reasoning and NSI flags) — the seeded 12×7 run proves the pipeline end-to-end.
- **Sidebar nav**: new links for `/recommend` and `/report`.

Phase 5 does NOT add new research topics, build export-to-PDF, add scheduled refresh, or build a visual network graph. All data is read from tables already populated by Phases 1–4.

</domain>

<decisions>
## Implementation Decisions

### Recommender UI & Flow
- **D-01:** Consortium recommender lives on a dedicated **`/recommend` page** linked from the sidebar nav. It does not live on `/analysis` or as a modal from the dashboard.
- **D-02:** Capability mix input uses **stepper counters** — one +/− counter per capability tag (Consultancy, Infrastructure, Nuclear). Compact, maps exactly to the requirements. Runs inline when user clicks "Get recommendation."
- **D-03:** Recommendation computation goes through an **API route `/api/recommend`** (not a Server Action and not client-side). The route reads all firms, conflict pairs, ownership records, partnership pairs, risk flags, and procurement records from the DB and runs the rules algorithm.

### Scoring & Ranking Logic
- **D-04:** The API returns **one primary recommendation + 2 ranked alternatives**. The primary recommendation is displayed prominently; the 2 alternatives are shown below so the user can compare. This naturally enables CONS-05 (user can see alternatives and adjust).
- **D-05:** Scoring uses **all four secondary signals** beyond capability coverage and conflict exclusion: (1) prior partnerships (from `partnershipPairs` — teams with evidence of prior joint delivery score higher), (2) UK ownership / NSI (from `ownershipRecords` — more UK-owned firms score higher), (3) contract relevance (from `procurementRecords` — stronger procurement history scores higher), (4) risk flags (from `riskFlags` — fewer/lower-severity flags score higher).
- **D-06:** Scoring weights are **user-configurable via sliders** before running. Each of the 4 signals has a weight slider (0–100). The reasoning panel in the result shows the per-signal score breakdown per firm so the recommendation is fully auditable (satisfies CONS-02 explainability).

### Override UX (CONS-05)
- **D-07:** An **expandable "Lock firms" section** appears below the capability counters on `/recommend`. Before the first computation, the user can toggle a lock on any firm. Locked firms are always included in the recommendation; the algorithm fills the remaining slots with the best-scoring available firms.
- **D-08:** Override uses a **lock-and-recompute pattern**: after seeing the result, the user can lock firms they want to keep, then click "Recompute" to find the best remaining team around those locked firms. The API route respects `lockedFirmIds` in the request payload.
- **D-09:** The result display shows **inline conflict badges** per firm in the recommended team: capability tags, ownership badge (UK/foreign ISO code), any conflicts with other team members highlighted in red, and risk flag count. These update instantly on each recompute.

### "Initial Report" Output
- **D-10:** The initial report is a **dedicated `/report` page** linked from the sidebar nav.
- **D-11:** The `/report` page shows **just the recommendation output** — the best consortium for a default 1+1+1 (one each of Consultancy, Infrastructure, Nuclear) applied to the seeded 12 firms, with full reasoning (capability coverage, conflict exclusions, signal scores, NSI considerations per firm). Running the seeded 12×7 pipeline and verifying the /report page renders correctly is the Phase 5 end-to-end proof.

### Claude's Discretion
- Exact visual layout of the weight sliders on `/recommend` (before or alongside the capability counters, or in a separate "Advanced" accordion).
- Whether the `/report` page renders the full recommendation card (same component as `/recommend`) or a simplified print-friendly layout.
- Tie-breaking within equally-scored combinations (e.g., alphabetical by firm name, or by number of procurement records).
- Error states on `/api/recommend` when insufficient firms exist for the requested mix.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Success Criteria
- `.planning/REQUIREMENTS.md` §Consortium Recommendation (CONS-01 to CONS-05) — 5 requirements this phase satisfies
- `.planning/ROADMAP.md` §Phase 5 — 5 success criteria that define "done"

### Database Schema (read before any query or algorithm decisions)
- `src/db/schema.ts` — tables to query: `firms` (capability tags), `conflictPairs` (firmAId, firmBId, conflictType), `partnershipPairs` (firmAId, firmBId, partnershipType), `ownershipRecords` (per-firm, UK status, parent country), `riskFlags` (per-firm, severity), `procurementRecords` (supplierChNumber — for contract relevance scoring). Algorithm must not mutate any of these tables.

### Prior Phase Context
- `.planning/phases/04-cross-cutting-analysis/04-CONTEXT.md` — Phase 4 decisions: how conflict pairs, partnership pairs, ownership records, and risk flags were extracted and stored; BullMQ patterns; citation enforcement; "not found" sentinels.

### UI Patterns (reuse from Phase 3 & 4)
- `.planning/phases/03-dashboard-profiles/03-UI-SPEC.md` — design system (shadcn base-nova, Plus Jakarta Sans, oklch CSS variables), spacing/typography scale, existing component inventory.
- `src/app/(app)/analysis/page.tsx` — route structure pattern to follow for `/recommend` and `/report` pages.
- `src/components/analysis/conflict-matrix.tsx` — existing conflict matrix component; may be reused or adapted for inline conflict display on the recommendation result.

### Stack & Conventions
- `CLAUDE.md` §Technology Stack — locked stack (Next.js App Router, Drizzle/Postgres, BullMQ/Redis, Vercel AI SDK 5, shadcn/ui, Zod). No new dependencies without justification.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `conflictPairs`, `partnershipPairs`, `ownershipRecords`, `riskFlags`, `procurementRecords` tables — all populated by Phases 1–4; the recommender algorithm reads from these directly via Drizzle queries.
- `src/lib/types.ts` — `ConflictPair`, `PartnershipPair`, `OwnershipRecord`, `RiskFlag`, `ProcurementRecord`, `CapabilityTag` types already defined; use these as the algorithm's input types.
- `src/components/analysis/conflict-matrix.tsx`, `partnership-table.tsx`, `ownership-rollup.tsx` — Phase 4 components; the inline conflict badge on the recommendation result can borrow the conflict-badge rendering logic.
- shadcn/ui `Badge`, `Card`, `Separator`, `Tabs`, `Table` — established in Phase 3; use for `/recommend` and `/report` layouts.
- `src/app/(app)/layout.tsx` — sidebar nav where `/recommend` and `/report` links are added.

### Established Patterns
- **Citation enforcement**: any claim surfaced in the recommendation result that comes from a DB record must carry the source URL/title — do not surface unsourced assertions.
- **"Not found" is explicit**: if no valid combination exists for the requested mix, return an explicit "no valid team found" state (not silence).
- **Drizzle query pattern**: complex joins are done via Drizzle `leftJoin`/`innerJoin`; see `src/lib/cross-cutting/conflicts.ts` for existing multi-table query pattern.
- **API routes**: `src/app/api/` for existing API routes; `/api/recommend` follows the same structure.

### Integration Points
- `src/app/(app)/recommend/page.tsx` — new route (client component with capability counters, lock section, weight sliders, and result display).
- `src/app/(app)/report/page.tsx` — new route (server component that calls the recommend API with default 1+1+1 + no locks and renders the result).
- `src/app/api/recommend/route.ts` — new API route; POST body: `{ capabilityMix: { Consultancy: number, Infrastructure: number, Nuclear: number }, lockedFirmIds: string[], weights: { partnerships: number, ukOwnership: number, contractRelevance: number, riskFlags: number } }`.
- `src/app/(app)/layout.tsx` — add "Recommend" and "Report" nav items to the sidebar.

</code_context>

<specifics>
## Specific Ideas

- The **lock section** on `/recommend` is collapsible/expandable (not always visible) so it doesn't clutter the default flow. User expands it only if they want to pre-lock their own firm.
- The **weight sliders** can default to equal weights (25/25/25/25). The reasoning panel always shows the computed score per signal so the user understands why one team was preferred over another.
- The **primary recommendation** is displayed as a card with each firm in its own sub-card showing: firm name, capability tags, ownership badge, risk flag count, and any intra-team conflict (red badge). This is the same "inline conflict badges" pattern (D-09).
- The `/report` page is the **proof of end-to-end pipeline**: if it renders a complete, reasoned 1+1+1 recommendation from the seeded 12 firms, the pipeline is proven. The phase is not complete until `/report` renders without errors on a fully-seeded database.

</specifics>

<deferred>
## Deferred Ideas

- **Export to PDF/document** — significant implementation lift; deferred to v2. (COLL-01 in REQUIREMENTS.md is already tagged v2.)
- **Network graph visualisation** of firm relationships — VIS-01 in v2 requirements; not in Phase 5.
- **Scheduled/automated refresh** for the initial report — MON-01 in v2 requirements.
- **Multi-signal weight presets** ("NSI-first", "Partnership-first") — nice UX addition but not required; defer to v2.
- **Rename the tool "Partnerships"** — product-level naming decision; carried from Phase 4 deferred list; defer to milestone close.

</deferred>

---

*Phase: 5-Consortium Recommender + Initial Report*
*Context gathered: 2026-06-16*
