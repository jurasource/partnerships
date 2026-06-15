# Phase 4: Cross-Cutting Analysis - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 materialises derived relationship records from existing research findings and structured UK data sources, then surfaces them in the dashboard and firm profiles. The phase delivers:

- **Ownership records per firm** (PROF-04, ANAL-03): UK-incorporated status, immediate PSC nationality from Companies House, ultimate parent where detectable, corroborated by the topic-6 AI finding ("which firms not UK owned").
- **Risk flags per firm** (PROF-05): financial, reputational, and regulatory flags extracted from topic-3 findings ("high risk firms and why"), with severity and dated source citations.
- **Collaboration history per firm** (PROF-07): prior joint delivery evidence (co-supplier OCDS records, announced JVs) and cultural fit signals, extracted from topic-7 findings ("which firms currently work together").
- **Conflict pairs** (ANAL-01): audit relationships and direct competitor relationships between firm pairs, extracted from topic-4 findings ("conflicts between firms"), with sourced evidence — never auto-asserted conclusions.
- **Partnership pairs** (ANAL-02): co-supplier procurement evidence and announced JV partnerships, extracted from OCDS `procurementRecords` and topic-7 findings.
- **A new /analysis page** surfacing a conflict matrix (firm × firm grid), partnership summary table, and ownership nationality roll-up.
- **Firm profile additions**: ownership section, risk flags section, collaboration history section, and from-that-firm's-perspective conflict/partnership lists.
- **Comparison table addition**: new "Ownership" column with UK/foreign badge (colour-coded, sortable).
- **Recompute on refresh** (ANAL-04): when any firm is refreshed, a separate BullMQ job is enqueued for that firm's cross-cutting extraction pass (its own ownership/risk/collaboration records + all conflict/partnership pairs involving it).

Phase 4 does NOT build the consortium recommender (Phase 5), add new Tavily searches, or build ML-based analysis. All structured facts are extracted from already-cached findings and CH data.

</domain>

<decisions>
## Implementation Decisions

### Facts Extraction Strategy
- **D-01:** Cross-cutting structured records are populated by re-processing existing Phase 2 findings — a second LLM pass reads the cached topic-3/4/6/7 findings and extracts structured JSON. No new Tavily calls. Works entirely from the research cache.
- **D-02:** When a firm has no Phase 2 findings (never researched), cross-cutting records for that firm are left empty. The profile shows a clear "Run research first to enable cross-cutting analysis" state. No automatic research trigger.
- **D-03:** Conflict detection scope (ANAL-01): both audit relationships AND direct competitor relationships, AI-extracted from the topic-4 finding for each firm. The extraction pass identifies named pairs with the evidence already present in the finding citation.

### Cross-Firm UI Surface
- **D-04:** Conflict pairs and partnership pairs surface on a **new `/analysis` page** with three sections: (1) conflict matrix (firm × firm grid, flagged cells highlighted); (2) partnership evidence table (who works with whom, with OCDS and finding sources); (3) ownership nationality roll-up (how many firms UK-owned vs foreign, with breakdown).
- **D-05:** Firm profiles **also** surface that firm's relationships from its own perspective: a "Conflicts of Interest" section listing which other firms it conflicts with and why, and a "Known Partnerships" section listing co-supplier/JV evidence. Users navigating from a firm profile do not need to go to /analysis to see its conflicts.
- **D-06:** The sidebar/nav gains a link to `/analysis` alongside the existing Dashboard entry.

### Ownership Tracing Depth
- **D-07:** Ownership tracing uses CH PSC first-level data (immediate PSC jurisdiction, nationality, % control) corroborated by the topic-6 AI finding ("which firms not UK owned"). For firms where the PSC is a foreign corporate entity with no UK registration, the record is flagged: "ultimate parent not publicly traceable via CH — see AI finding for context."
- **D-08:** No recursive CH lookup for parent companies in Phase 4. Parent chain depth is first-level PSC from CH + AI finding text. Deeper tracing is a v2 enhancement.
- **D-09:** The comparison table gets a new **"Ownership" column**: a colour-coded badge showing "UK" (green) or the parent country ISO code (amber), derived from the ownership record. Column is sortable so users can group non-UK firms. Sources link to the CH PSC entry or the topic-6 finding.

### Recompute Trigger (ANAL-04)
- **D-10:** When a firm's research job completes (BullMQ worker transitions job to `done`), it **enqueues a separate BullMQ job** of a new type (`cross-cutting-analysis`) for that firm. This decouples research from extraction and keeps concerns separate.
- **D-11:** The cross-cutting job recomputes: the firm's own ownership record, risk flags, and collaboration history; AND all conflict/partnership pairs where that firm is either participant. Pair records are computed using the firm's new findings + existing findings for the counterpart firms. Other firms' own records are untouched.
- **D-12:** The `/jobs` page shows both job types (`research` and `cross-cutting-analysis`) with appropriate labels so the user can see both passes completing.

### Folded Todos
- **CH number as external link to Companies House**: The Companies House number displayed on firm profiles (PROF-04 ownership section) is rendered as a clickable external link to `https://find-and-update.company-information.service.gov.uk/company/{number}`. This naturally lands alongside the ownership section added in Phase 4.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Success Criteria
- `.planning/REQUIREMENTS.md` §Cross-Cutting Analysis (ANAL-01 to ANAL-04) — 4 requirements this phase satisfies
- `.planning/REQUIREMENTS.md` §Firm Profiles (PROF-04, PROF-05, PROF-07) — 3 profile requirements this phase satisfies
- `.planning/ROADMAP.md` §Phase 4 — 5 success criteria that define "done"

### Database Schema (read before any schema or query decisions)
- `src/db/schema.ts` — existing tables: `firms`, `topics`, `findings` (unique on firm×topic), `procurementRecords` (supplier_ch_number, ocid), `jobs`. Phase 4 adds new tables for derived records — do NOT reuse `findings` for cross-firm pairs (unique constraint is firm×topic, can't represent pairs).

### Research Data Sources (Phase 2 output that Phase 4 re-processes)
- Topic 3 in the seeded topics: "High risk firms and why" → source for risk flag extraction
- Topic 4: "Conflicts between firms (audit relationships, direct competitors)" → source for conflict pair extraction
- Topic 6: "Which firms are not UK owned" → source for ownership corroboration
- Topic 7: "Which firms currently work together" → source for partnership/collaboration extraction
- These are all in the `findings` table keyed by (firmId, topicId). The extractor reads these findings by looking up the topic by name.

### Prior Phase Context
- `.planning/phases/02-research-engine/02-CONTEXT.md` — citation enforcement rules (D-11), research worker pattern (BullMQ), "not found" sentinel values

### Stack & Architecture
- `CLAUDE.md` §Technology Stack — locked stack (Next.js 16 App Router, Drizzle/Postgres, BullMQ/Redis, Vercel AI SDK 5, Zod, shadcn/ui)
- `src/scripts/worker-process.ts` — existing BullMQ worker; Phase 4 extends this to handle `cross-cutting-analysis` job type
- `src/lib/jobs/bull.ts` — queue config; new job type registration
- `src/lib/research/grounding.ts` — `buildGroundingContext` fetches CH profile + PSC live; Phase 4 should persist a structured ownership record from this data rather than re-fetching on every read

### UI Patterns (Phase 3 — reuse)
- `.planning/phases/03-dashboard-profiles/03-UI-SPEC.md` — design system (shadcn base-nova, Plus Jakarta Sans, oklch CSS variables), existing components list, spacing/typography scale
- `src/app/(app)/firms/[id]/page.tsx` — firm profile page to extend with PROF-04/05/07 sections
- `src/app/(app)/page.tsx` — comparison dashboard to extend with ownership column (ANAL-03)

### Companies House External Link (folded todo)
- CH company page URL pattern: `https://find-and-update.company-information.service.gov.uk/company/{companiesHouseNumber}`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/research/grounding.ts` — `buildGroundingContext` already fetches and parses CH PSC data (nationality, jurisdiction, corporate entity detection). Phase 4's ownership extraction can reuse or adapt this logic to persist a structured `ownership_records` row.
- `src/lib/clients/companies-house.ts` — `getCompanyProfile`, `getPSC` — already implemented and tested.
- `src/scripts/worker-process.ts` — BullMQ worker with job dispatch pattern; Phase 4 adds a new `switch` branch for `cross-cutting-analysis` job type.
- `src/lib/jobs/bull.ts` — queue config; Phase 4 registers the new job type here.
- `src/lib/jobs/runner.ts` — job runner utilities.
- `src/db/schema.ts` — `procurementRecords.supplierChNumber` and `procurementRecords.ocid` — co-supplier detection: find OCDS records where two different firms share the same `ocid` (awarded the same notice together).
- `ui/badge`, `ui/table`, `ui/tabs`, `ui/card`, `ui/separator` — Phase 3 established these; use for /analysis page layout.

### Established Patterns
- **BullMQ job lifecycle**: `pending → running → done | failed`, with `progressMessage` updates written by the worker. New `cross-cutting-analysis` jobs follow the same lifecycle and appear in `/jobs`.
- **Citation enforcement**: every derived record that surfaces a claim about a firm must carry a `sourceUrl`, `sourceTitle`, and either a `rawSnippet` (from the original finding) or a CH API reference. No unsourced records stored.
- **"Not found" is explicit**: if cross-cutting extraction finds no conflicts/risks/partnerships for a firm, store an explicit empty-state record (not silence). UI renders "No conflicts detected — based on available research."
- **Drizzle upsert pattern**: existing code uses `onConflictDoNothing` for OCDS dedup. Cross-cutting records should use `onConflictDoUpdate` (replacing on re-extract) since they are recomputed, not accumulated.
- **Server-only removed from lib/**: Phase 2 decision — `src/lib/` files omit `"server-only"` so they're importable by the standalone worker. Phase 4 follows the same rule for new lib files.

### Integration Points
- **Firm profile** (`/firms/[id]`): add three new sections below the existing finding tabs — Ownership (PROF-04), Risk Flags (PROF-05), Collaboration History (PROF-07) — plus Conflicts of Interest and Known Partnerships from this firm's perspective.
- **Comparison table** (`/` or `/dashboard`): add "Ownership" column alongside existing capability tags, contract count, research status columns.
- **New `/analysis` route**: add to `src/app/(app)/analysis/page.tsx`. Add sidebar nav entry.
- **Research worker completion hook**: in `src/scripts/worker-process.ts`, after the research job transitions to `done`, enqueue a `cross-cutting-analysis` job for that firmId.

</code_context>

<specifics>
## Specific Ideas

- The conflict matrix on `/analysis` should be a firm × firm grid where flagged cells are highlighted (red or amber badge). Non-conflicted pairs are empty cells, not "No conflict" text — keeps the matrix scannable.
- Ownership badge on comparison table: "UK" in green, foreign country code (ISO 2-letter) in amber. Sort by this column to group all non-UK firms together for quick NSI assessment.
- Co-supplier detection from OCDS: two firms share a partnership signal when their `supplierChNumber` values both appear on notices under the same `ocid` (same procurement award). This is a SQL query, not an AI extraction.
- The `/analysis` page ownership roll-up section should show: total firms, UK-owned count, foreign-owned count (with country breakdown), and "ownership not determinable" count — a fast summary for NSI planning.
- Risk flags should show severity (High / Medium / Low) and the date of the sourced evidence — PROF-05 explicitly requires dated sources.

</specifics>

<deferred>
## Deferred Ideas

- "Name this tool 'Partnerships'" — not folded into Phase 4 (naming the whole app is a product-level decision, not a Phase 4 task). Carry forward as a backlog item for milestone close.
- "View firm refresh results after data pull" — partially addressed by PROF-04 (ownership panel) and PROF-05 (risk flags) appearing on profile after refresh. Full structured data view (CH raw profile panel in edit dialog) is out of scope.
- "Show Companies House summary panel in firm edit dialog" — out of scope for Phase 4. Deferred to v2 or a future quick task.
- "Discover unlisted firms with relevant capabilities" — out of scope (new capability, belongs in its own phase or backlog).
- "Consortium analysis firm selection and named groups" — Phase 5 scope; deferred.
- Recursive CH parent chain lookup (tracing foreign ultimate parents beyond first-level PSC) — v2 enhancement; not in Phase 4.
- SSE/streaming for cross-cutting job progress — polling is sufficient for v1 (established in Phase 2).

### Reviewed Todos (not folded)
- "Name this tool 'Partnerships'" — naming decision, deferred to milestone review.
- "View firm refresh results after data pull" — partially met by Phase 4 profile additions; structured CH panel in edit dialog is out of scope.

</deferred>

---

*Phase: 4-Cross-Cutting Analysis*
*Context gathered: 2026-06-15*
