# Phase 5: Consortium Recommender + Initial Report — Research

**Researched:** 2026-06-16
**Domain:** Deterministic TypeScript combinatorial scorer, Next.js App Router API routes, shadcn/ui component installation, Vitest unit/integration testing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Consortium recommender lives on a dedicated `/recommend` page linked from the sidebar nav.
- **D-02:** Capability mix input uses stepper counters — one +/− counter per capability tag (Consultancy, Infrastructure, Nuclear).
- **D-03:** Recommendation computation goes through an API route `/api/recommend` (not a Server Action, not client-side).
- **D-04:** The API returns one primary recommendation + 2 ranked alternatives.
- **D-05:** Scoring uses all four secondary signals: (1) prior partnerships, (2) UK ownership/NSI, (3) contract relevance, (4) risk flags.
- **D-06:** Scoring weights are user-configurable via sliders (0–100 per signal). Reasoning panel shows per-signal score breakdown per firm.
- **D-07:** Expandable "Lock firms" section on `/recommend`. Locked firms are always included.
- **D-08:** Override uses a lock-and-recompute pattern. The API respects `lockedFirmIds` in the request payload.
- **D-09:** Result display shows inline conflict badges, capability tags, ownership badge (UK/foreign ISO code), and risk flag count per firm. Updates on each recompute.
- **D-10:** Initial report is a dedicated `/report` page linked from the sidebar nav.
- **D-11:** `/report` shows the best 1+1+1 (one each of Consultancy, Infrastructure, Nuclear) from the seeded 12 firms with full reasoning. The seeded 12×7 pipeline run and a passing `/report` page render is the Phase 5 end-to-end proof.

### Claude's Discretion

- Exact visual layout of the weight sliders on `/recommend` (before/alongside capability counters, or in a separate "Advanced" accordion).
- Whether `/report` renders the full recommendation card (same component as `/recommend`) or a simplified print-friendly layout.
- Tie-breaking within equally-scored combinations (e.g., alphabetical by firm name, or by number of procurement records).
- Error states on `/api/recommend` when insufficient firms exist for the requested mix.

### Deferred Ideas (OUT OF SCOPE)

- Export to PDF/document — deferred to v2.
- Network graph visualisation of firm relationships — v2 (VIS-01).
- Scheduled/automated refresh for the initial report — v2 (MON-01).
- Multi-signal weight presets ("NSI-first", "Partnership-first") — defer to v2.
- Rename the tool "Partnerships" — defer to milestone close.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONS-01 | User can request a consortium recommendation for a specified capability mix (e.g. one each of Cons, Infra, Nuc) | `/api/recommend` POST handler with `capabilityMix` field; `CapabilityMixInput` stepper component; `scoreAndRankCombinations()` pure function |
| CONS-02 | Recommendation is rules-based and explains its reasoning — capability coverage, conflict exclusions, contract relevance — not a black box | `FirmScoreBreakdown` per-signal scores; `ScoreBreakdown` collapsible table showing per-firm signal scores; `RecommendResponseSchema` enforces presence of breakdown fields |
| CONS-03 | Recommendation automatically excludes firm pairs with flagged conflicts of interest | `buildConflictSet()` + `hasConflict()` using O(1) Set lookup; conflict exclusion applied before scoring, not after |
| CONS-04 | Recommendation surfaces foreign ownership and NSI considerations for each recommended firm | `ownershipRecord` non-null in every `FirmScoreBreakdown`; NSI badge rendered regardless of `ukOwnership` weight; `scoreUkOwnership()` signal scorer |
| CONS-05 | User can override or adjust recommended firms and see updated conflict/capability analysis | Lock-and-recompute pattern (D-07, D-08); `lockedFirmIds` in API request; "Lock these firms & recompute" button; Reset link |
</phase_requirements>

---

## Summary

Phase 5 delivers a deterministic, rules-based consortium recommender — no LLM in the scoring path. The AI-SPEC verdict is `NO_AI_NEEDED`: all ranking is a weighted sum of four DB-sourced signals (contract relevance, UK ownership/NSI, prior partnerships, risk flags) with hard conflict exclusion enforced before scoring. This is a greenfield phase: no `/recommend`, `/report`, or `/api/recommend` routes exist yet, no `src/lib/recommend/` module exists, and the three required shadcn components (Slider, Accordion, Card) are not yet installed.

The phase also carries a critical dependency: Plan 04-04 (the `/analysis` page, conflict matrix, partnership table, ownership rollup, and Analysis nav link) was planned but not executed — no `src/app/analysis/page.tsx` exists, no `src/components/analysis/` directory exists, and the "Analysis" navbar item still points to `"#"`. Phase 5 must either complete this as a prerequisite plan or treat the Analysis nav link promotion as part of Phase 5 scope (UI-SPEC already scopes it: "carry if not yet done by Phase 4-04").

All data tables Phase 5 reads from (`conflictPairs`, `partnershipPairs`, `ownershipRecords`, `riskFlags`, `procurementRecords`) are populated by Phases 1–4. Phase 5 is read-only with respect to these tables.

**Primary recommendation:** Implement Phase 5 as three vertical slices: (1) the scoring engine + API route + test suite, (2) the `/recommend` page with UI components, (3) the `/report` page + end-to-end seeded proof. Add the Plan 04-04 deliverables as a prerequisite Wave 0 task or a Wave 1 task so the sidebar nav is coherent before `/recommend` and `/report` land.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capability mix input (stepper counters) | Browser / Client | — | Pure client state (`useState` per tag); no server round-trip until submit |
| Weight slider configuration | Browser / Client | — | Client state only; passed in POST body on submit |
| Lock firms selection | Browser / Client | — | Client state; `lockedFirmIds` array passed in POST body |
| Consortium scoring algorithm | API / Backend | — | Pure TypeScript function called from Next.js Route Handler; no LLM, no DB inside scorer |
| DB signal loading (parallel reads) | API / Backend | Database / Storage | Route handler loads all signals in `Promise.all` before calling scorer |
| Response schema validation | API / Backend | — | `RecommendResponseSchema.parse()` validates scorer output before `NextResponse.json()` |
| Recommendation result display | Browser / Client | — | Re-rendered after each API response (in-page, no navigation) |
| `/report` page render | Frontend Server (SSR) | API / Backend | Server component calls `/api/recommend` at render time; no client state |
| Conflict badge rendering | Browser / Client | — | Per-firm `conflictPairs` data returned in API response and rendered inline |
| NSI/ownership badge | Browser / Client | — | `ownershipRecord` returned per firm in `FirmScoreBreakdown`; rendered unconditionally |
| Sidebar nav additions | Browser / Client | Frontend Server (SSR) | Nav links added to `app-navbar.tsx`; active state via `usePathname()` |
| Vitest unit tests | — | — | Pure-function tests with no DB; integration test uses seeded Postgres |

---

## Standard Stack

### Core (All Already Installed — No New Dependencies for Scoring)

| Library | Installed Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| TypeScript | 6.0.3 [VERIFIED: npm ls] | Scorer, schemas, route handler, UI components | Project baseline; pure-function scoring has no external runtime dependency |
| Zod | 4.4.3 [VERIFIED: npm ls] | Request/response schema validation at API boundary | Already in project; Zod 4 `discriminatedUnion` used in `RecommendResponseSchema`; `.safeParse()` on untrusted input |
| Vitest | 4.1.8 [VERIFIED: npm ls] | Unit + integration test suite for scorer | Already in project; pure-function tests run in < 100ms with no DB mocking |
| Next.js | 16.2.9 [VERIFIED: npm ls] | App Router Route Handler for POST `/api/recommend`; Server Component for `/report` | Project baseline |
| Drizzle ORM | 0.45.2 [VERIFIED: npm ls] | `db.select()` reads from `firms`, `conflictPairs`, `partnershipPairs`, `ownershipRecords`, `riskFlags`, `procurementRecords` | Project baseline; parallel reads via `Promise.all` |

### New shadcn Components to Install

| Component | Install Command | Purpose | Already Installed? |
|-----------|----------------|---------|-------------------|
| `ui/slider` | `npx shadcn add slider` | Weight configuration sliders (D-06) | No — not in `src/components/ui/` [VERIFIED: ls] |
| `ui/accordion` | `npx shadcn add accordion` | Collapsible "Lock firms" and "Scoring weights" sections (D-07) | No — not in `src/components/ui/` [VERIFIED: ls] |
| `ui/card` | `npx shadcn add card` | Firm sub-cards within recommendation result (D-09) | No — not in `src/components/ui/` [VERIFIED: ls] |

**Version verification:** Shadcn CLI (v4.11.0 [VERIFIED: npm ls]) generates components from the official registry at install time — no version pinning needed; the CLI resolves the correct component version for the installed shadcn preset (`base-nova`). [ASSUMED: base-nova preset supports Slider, Accordion, Card — this is standard shadcn component coverage but not verified against the specific preset version in this session.]

**Installation:**
```bash
npx shadcn add slider accordion card
```

### Package Legitimacy Audit

| Package | Registry | Verdict | Notes |
|---------|----------|---------|-------|
| zod | npm | OK [VERIFIED: gsd-tools legitimacy check] | 196M downloads/wk; colinhacks/zod |
| vitest | npm | SUS [VERIFIED: gsd-tools legitimacy check — flagged "too-new"] | 69M downloads/wk; vitest-dev/vitest. Flagged `too-new` because a new patch (4.1.9) published 2026-06-15, one day before research. The installed version 4.1.8 has been in project since Phase 1 and is the authoritative installed version. **No action required** — this is a legitimate registry freshness signal on a new patch release, not a slopsquatting risk. |
| shadcn (CLI) | npm | OK [VERIFIED: npm ls — 4.11.0 installed] | Official shadcn CLI; registry at ui.shadcn.com |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** vitest — no action required (see Notes above; installed version 4.1.8 predates the flagged new release)

---

## Architecture Patterns

### System Architecture Diagram

```
POST /api/recommend
  │
  ├─ [1] Zod safeParse(RecommendRequestSchema)  ← rejects malformed input (400)
  │
  ├─ [2] Promise.all DB reads (read-only)
  │       ├── db.select().from(firms)
  │       ├── db.select().from(conflictPairs)
  │       ├── db.select().from(partnershipPairs)
  │       ├── db.select().from(ownershipRecords)
  │       ├── db.select().from(riskFlags)
  │       └── db.select().from(procurementRecords)
  │
  ├─ [3] scoreAndRankCombinations(input)  ← pure function, no DB
  │       ├── buildConflictSet()          ← O(conflicts) Set build, once
  │       ├── combinations(unlocked, k)   ← generate k-choose-n
  │       ├── for each combo:
  │       │    ├── hasConflict() → skip   ← O(1) Set lookup
  │       │    ├── capability check → skip if gap
  │       │    └── score each firm:
  │       │         ├── scoreContractRelevance()
  │       │         ├── scoreUkOwnership()
  │       │         ├── scoreRiskFlags()
  │       │         └── scoreCapabilityMatch()
  │       ├── teamHasPriorPartnerships() → partnership bonus
  │       └── sort top 3 by score (tie-break: alphabetical)
  │
  ├─ [4] RecommendResponseSchema.parse()  ← contract validation
  │
  └─ [5] NextResponse.json(validated)

/report (Server Component)
  └─ fetch("/api/recommend", { method: "POST", body: default 1+1+1 })
      └─ renders <RecommendationResult /> read-only
```

### Recommended Project Structure

```
src/
├── lib/
│   └── recommend/
│       ├── schemas.ts          # Zod 4 request + response schemas (NO Next.js imports)
│       ├── scorer.ts           # Pure scoring functions + scoreAndRankCombinations()
│       ├── combinations.ts     # combinations<T>(arr, k): T[][] helper
│       └── __tests__/
│           ├── scorer.test.ts  # Unit tests: E1–E8 pure-function evals
│           ├── schemas.test.ts # Zod parse/safeParse boundary tests
│           └── seeded-e2e.test.ts  # E9 seeded 12×7 + snapshot (requires Postgres)
├── app/
│   ├── api/
│   │   └── recommend/
│   │       └── route.ts        # POST handler: validate → load DB → score → respond
│   └── (app)/                  # NOTE: route group IS "(app)" per existing codebase
│       ├── recommend/
│       │   └── page.tsx        # "use client" — stateful: mix, locks, weights, result
│       └── report/
│           └── page.tsx        # RSC — calls /api/recommend, renders read-only result
└── components/
    └── recommend/
        ├── capability-mix-input.tsx   # Three stepper counters
        ├── weight-sliders.tsx         # Four Slider instances (shadcn ui/slider)
        ├── lock-firms-section.tsx     # Accordion + firm checkboxes (shadcn ui/accordion)
        ├── recommendation-result.tsx  # Primary card + 2 alternatives
        ├── firm-sub-card.tsx          # Per-firm Card (shadcn ui/card) with badges
        ├── score-breakdown.tsx        # Collapsible reasoning table
        └── no-valid-team-state.tsx    # Empty state when no valid team
```

### Critical Route Group Clarification

The PLAN 04-04 had a `<critical_correction>` noting that routes live at `src/app/page.tsx` not `src/app/(app)/page.tsx`. However, the **actual codebase** has route group `(app)`: `src/app/(app)/page.tsx`, `src/app/(app)/firms/page.tsx`, etc. [VERIFIED: ls]. Phase 5 routes MUST be created at:
- `src/app/(app)/recommend/page.tsx`
- `src/app/(app)/report/page.tsx`

The API route is NOT in the route group:
- `src/app/api/recommend/route.ts` [VERIFIED: existing pattern — `src/app/api/research/run/route.test.ts` exists at this path]

### Pattern 1: Pure-Function Scorer Separated from DB Layer

**What:** All DB reads happen in the Route Handler. The scorer is a pure function taking plain objects and returning `ScorerResult`. No DB calls inside the scorer.

**When to use:** Always. This is the only testable pattern — Vitest tests call the scorer directly with fixture objects, no Postgres connection needed.

```typescript
// src/app/api/recommend/route.ts
// Source: AI-SPEC.md §3 Entry Point Pattern
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RecommendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { capabilityMix, lockedFirmIds, weights } = parsed.data;

  const [allFirms, allConflicts, allPartnerships, allOwnership, allRiskFlags, allProcurement] =
    await Promise.all([
      db.select().from(firms),
      db.select().from(conflictPairs),
      db.select().from(partnershipPairs),
      db.select().from(ownershipRecords),
      db.select().from(riskFlags),
      db.select().from(procurementRecords),
    ]);

  const result = scoreAndRankCombinations({
    capabilityMix, lockedFirmIds, weights,
    firms: allFirms, conflicts: allConflicts, partnerships: allPartnerships,
    ownership: allOwnership, riskFlags: allRiskFlags, procurement: allProcurement,
  });

  const validated = RecommendResponseSchema.parse(result);
  return NextResponse.json(validated);
}
```

### Pattern 2: Conflict Exclusion via O(1) Set

**What:** Build a `Set<string>` of canonical pair keys once before the combination loop. Key format: `"${[a,b].sort().join('__')}"`. O(1) lookup per pair check.

**When to use:** Always for conflict checking. Never use `conflicts.find()` inside the combination loop.

```typescript
// Source: AI-SPEC.md §3 Key Abstractions + §4 scoreAndRankCombinations
export function buildConflictSet(conflicts: ConflictPair[]): Set<string> {
  const set = new Set<string>();
  for (const c of conflicts) {
    const key = [c.firmAId, c.firmBId].sort().join("__");
    set.add(key);
  }
  return set;
}

export function hasConflict(firmIds: string[], conflictSet: Set<string>): boolean {
  for (let i = 0; i < firmIds.length; i++) {
    for (let j = i + 1; j < firmIds.length; j++) {
      if (conflictSet.has([firmIds[i], firmIds[j]].sort().join("__"))) return true;
    }
  }
  return false;
}
```

### Pattern 3: Zod 4 discriminatedUnion for Response Shape

**What:** The response schema uses `z.discriminatedUnion("status", [...])` so the UI can type-narrow with a switch on `response.status`. Use `.safeParse()` on untrusted input (request body). Use `.parse()` on controlled output (scorer result — throw if the contract is broken, that is a bug).

```typescript
// Source: AI-SPEC.md §4b.1 Structured I/O Typing with Zod 4
export const RecommendResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    recommendations: z.array(TeamRecommendationSchema).min(1).max(3),
  }),
  z.object({
    status: z.literal("no_valid_team"),
    reason: z.string(),
    recommendations: z.array(TeamRecommendationSchema).length(0),
  }),
]);
```

### Pattern 4: Shadcn Base UI Render-Prop Pattern (NOT asChild)

**What:** This project uses `@base-ui/react` (not Radix), meaning shadcn components use render-prop pattern: `render={<Link href="..." />}` instead of `asChild`. Established in Plan 01-01. [VERIFIED: STATE.md decision "Plan 01-01: shadcn 2025 uses Base UI (render prop) not Radix (asChild)"]

**When to use:** Any shadcn Button, SidebarMenuButton, or polymorphic component that wraps another element.

```typescript
// CORRECT for this project
<Button render={<Link href="/recommend" />} className="bg-blue-600 text-white">
  Get Recommendation
</Button>

// WRONG — Radix pattern, not used in this project
<Button asChild><Link href="/recommend">Get Recommendation</Link></Button>
```

### Pattern 5: /report as Server Component Calling /api/recommend

**What:** `/report` page is an RSC. It calls the API route at server render time with the default 1+1+1 payload. It renders `<RecommendationResult />` in read-only mode (no weight sliders, no lock section, no "Recompute" button).

```typescript
// src/app/(app)/report/page.tsx
// Source: AI-SPEC.md §3 Project Structure; CONTEXT.md D-10, D-11
export const dynamic = "force-dynamic";  // no static cache on the report

export default async function ReportPage() {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
      lockedFirmIds: [],
      weights: { contractRelevance: 25, ukOwnership: 25, partnerships: 25, riskFlags: 25 },
    }),
  });
  const data = await res.json();
  // ... render
}
```

**Note:** In Next.js App Router RSC, use absolute URL for `fetch()` in production or use the internal route handler directly by importing `scoreAndRankCombinations` and calling the DB layer. The direct import approach avoids HTTP round-trip. [ASSUMED: direct import preferred over HTTP fetch for same-process RSC] — planner should choose based on code reuse trade-off.

### Pattern 6: Navbar Nav Item Promotion (app-navbar.tsx)

**What:** The project uses `app-navbar.tsx` (not `app-sidebar.tsx` — that file does not exist [VERIFIED: ls]). Phase 5 must update `app-navbar.tsx` to move "Consortium" from `PLACEHOLDER_ITEMS` to `NAV_ITEMS` and add "Report".

```typescript
// src/components/app-navbar.tsx — current state [VERIFIED: file read]
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Firms", href: "/firms", icon: Building2 },
  { label: "Topics", href: "/topics", icon: BookOpen },
  { label: "Jobs", href: "/jobs", icon: Activity },
];
const PLACEHOLDER_ITEMS: NavItem[] = [
  { label: "Analysis", href: "#", icon: BarChart3, disabled: true },  // Phase 4-04 not done
  { label: "Consortium", href: "#", icon: Users, disabled: true },
];
```

Phase 5 must add to `NAV_ITEMS`:
- `{ label: "Recommend", href: "/recommend", icon: Users }` (move from placeholder)
- `{ label: "Report", href: "/report", icon: FileText }` (new — import `FileText` from lucide-react)

The "Analysis" placeholder: Phase 5 UI-SPEC says to promote it to `href="/analysis"` only if Phase 4-04 is complete. Since Phase 4-04 is NOT complete, either: (a) include its deliverables as Wave 0 of Phase 5, or (b) leave Analysis as placeholder. The planner must decide.

### Anti-Patterns to Avoid

- **DB query inside the combination loop:** Never call `db.select()` inside `scoreAndRankCombinations()`. Load all signals once in the Route Handler, pass as plain arrays.
- **`conflicts.find()` inside combination loop:** O(n) per pair, degrades as firms scale. Always use the pre-built `Set`.
- **Putting schemas in `route.ts`:** Schemas must be in `src/lib/recommend/schemas.ts` (no Next.js imports) so Vitest can import them without mocking the Next.js router/DB client.
- **Silent empty array on no-valid-team:** Must return `{ status: "no_valid_team", reason: string, recommendations: [] }` — never `{ status: "ok", recommendations: [] }`.
- **Suppressing NSI badge when `ukOwnership` weight === 0:** The weight controls scoring influence, not badge visibility. `ownershipRecord` must be returned regardless of weight configuration.
- **Using `asChild` prop on shadcn components:** This project uses Base UI render-prop pattern, not Radix. Use `render={<Link />}` not `asChild`.
- **Writing to `conflictPairs`, `partnershipPairs`, `ownershipRecords`, `riskFlags`, or `procurementRecords` tables:** Phase 5 is read-only. These tables are owned by Phases 1–4.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slider UI component | Custom range input with CSS | `npx shadcn add slider` | Matches design system, accessible, touch-friendly — Phase 5 uses four of these |
| Accordion / collapsible | CSS `display:none` toggle | `npx shadcn add accordion` | shadcn Accordion has proper keyboard accessibility and animation via Base UI |
| Card layout primitive | `<div className="border rounded-lg">` | `npx shadcn add card` | Consistent with design system; shadcn Card provides `CardHeader`, `CardContent`, `CardFooter` slots |
| Schema validation | Manual `typeof` / `if` guards | Zod 4 `.safeParse()` + `z.discriminatedUnion()` | Already in project; discriminated union gives compile-time type narrowing for `status === "ok"` vs `"no_valid_team"` |
| Combinatorial generation | Custom bit-mask or nested loops | The `combinations<T>()` recursive helper | Simple, well-understood recursion; C(12,3)=220 — never an optimisation problem at this scale |
| Conflict Set lookup | `array.find()` per pair | `Set<string>` with canonical keys | O(1) vs O(n); the Set is the standard approach documented in AI-SPEC |
| Client-side fetch with loading state | Raw `fetch()` + `useState(loading)` | TanStack Query v5 (already in project at `@tanstack/react-table 8.21.3`) or simple `useState` + `fetch` | For a single POST endpoint with straightforward loading/error states, simple `useState` + `fetch` is sufficient; TanStack Query adds value only if caching or background re-fetch is needed |

**Key insight:** This is deliberately a no-new-dependency phase. The entire scoring algorithm is standard TypeScript arithmetic. The only additions are three shadcn component installs, which follow the existing pattern from Phases 1–4.

---

## Common Pitfalls

### Pitfall 1: Route Group Mismatch

**What goes wrong:** New pages are created at `src/app/recommend/page.tsx` instead of `src/app/(app)/recommend/page.tsx`. The pages render without the shared navbar (`AppLayout`) and look broken.

**Why it happens:** The PLAN 04-04 document had a `<critical_correction>` saying there is NO `(app)` route group. That was wrong. [VERIFIED: ls src/app/(app)/ shows firms, jobs, topics, page.tsx all inside the route group.]

**How to avoid:** Always create new app routes inside `src/app/(app)/`. API routes go directly in `src/app/api/` (no route group).

**Warning signs:** Pages load without the top navbar. Check route group placement first.

---

### Pitfall 2: Phase 4-04 Deliverables Not Complete

**What goes wrong:** Phase 5 plans assume the `/analysis` route and Analysis navbar link exist. They don't — Plan 04-04 was the final Phase 4 plan and was never executed [VERIFIED: no 04-04-SUMMARY.md exists; no src/app/analysis/ route; Analysis navbar item still disabled at `href="#"` in app-navbar.tsx].

**Why it happens:** Phase 4 STATE.md shows "Progress: 100%" but this reflects the plan documents being created, not all plans executed. Plan 04-04 is the analysis page plan — it has a blocking human-verify checkpoint (Task 2) that was never reached.

**How to avoid:** Phase 5 planner must include Phase 4-04 deliverables as Wave 0 tasks (prerequisite before Phase 5 features):
- `src/lib/queries/analysis-page.ts` (getAnalysisPageData)
- `src/app/(app)/analysis/page.tsx` (AnalysisPage RSC)
- `src/components/analysis/ownership-rollup.tsx`
- `src/components/analysis/conflict-matrix.tsx`
- `src/components/analysis/partnership-table.tsx`
- Promote "Analysis" from `PLACEHOLDER_ITEMS` to `NAV_ITEMS` in `app-navbar.tsx`

Or the planner may choose to defer the analysis page entirely and focus Phase 5 on `/recommend` and `/report` only — the CONS requirements do not depend on `/analysis` existing.

**Warning signs:** TypeScript errors importing from `@/components/analysis/...` — those files don't exist.

---

### Pitfall 3: Schemas Co-Located With Route Handler

**What goes wrong:** `RecommendRequestSchema` and `RecommendResponseSchema` are defined in `route.ts`. Vitest imports `scorer.ts` which imports `schemas.ts` which imports from `route.ts` which imports from `next/server`. Vitest fails with "Cannot import module 'next/server' in Node test environment".

**Why it happens:** Next.js route modules have implicit browser/server environment requirements that Vitest's Node environment cannot satisfy.

**How to avoid:** Schemas live exclusively in `src/lib/recommend/schemas.ts` with no Next.js imports. The route handler imports schemas from that path. This is the same pattern used for `src/lib/cross-cutting/schemas.ts` [VERIFIED: cross-cutting schema separation is established pattern].

**Warning signs:** Vitest tests fail with Next.js module import errors rather than assertion failures.

---

### Pitfall 4: Silent Empty Array on No Valid Team

**What goes wrong:** When no conflict-free, capability-covering combination exists, `scoreAndRankCombinations` returns `{ status: "ok", recommendations: [] }`. The `/recommend` result section shows nothing; the user cannot tell if the issue is data sparsity, over-broad conflicts, or a bug.

**Why it happens:** Default empty-array returns are easy to write; the explicit status field requires deliberate design.

**How to avoid:** The `ScorerResult` type has `status: "ok" | "no_valid_team"`. The scorer always returns a non-empty reason when `status === "no_valid_team"`. The `RecommendResponseSchema` discriminated union enforces this at the Zod validation layer. The `NoValidTeamState` component renders the reason copy.

**Warning signs:** UI shows a blank result section after a request that completes with HTTP 200.

---

### Pitfall 5: NSI Badge Suppressed When ukOwnership Weight Is Zero

**What goes wrong:** The `ownershipRecord` is not included in the `FirmScoreBreakdown` when the user has set `ukOwnership` slider to 0. The NSI badge is absent for foreign-owned firms in the result.

**Why it happens:** A naive implementation skips populating ownership data for signals with zero weight.

**How to avoid:** `ownershipRecord` is always populated in `FirmScoreBreakdown` regardless of weight configuration. The weight affects `ownershipScore * w.ukOwnership` in the weighted sum — it does NOT control whether the record is fetched or returned. This is enforced by eval dimension E2 in the test suite.

**Warning signs:** Foreign-owned firms appear in results without any ownership badge; changing `ukOwnership` weight from 0 to 1 makes the badge appear/disappear.

---

### Pitfall 6: Combination Generation at Wrong Scope

**What goes wrong:** `combinations()` is called with all 12 firms for team size 3, ignoring locked firms. Locked firms are then checked post-hoc and non-locked alternatives are generated unnecessarily.

**Why it happens:** Misreading the algorithm: locked firms fill slots first, then remaining slots are filled from unlocked firms.

**How to avoid:** The `slotsToFill = teamSize - lockedFirms.length`. Generate `combinations(unlockedFirms, slotsToFill)`. Combine with locked firms before scoring. This is C(unlocked, slotsToFill) — much smaller combination space when firms are locked.

---

### Pitfall 7: capabilityTags Stored as JSON String

**What goes wrong:** `firms.capabilityTags` is a `text` column containing a JSON array string (e.g. `'["Nuclear","Consultancy"]'`). Code that accesses `firm.capabilityTags` as an array without parsing throws or silently fails.

**Why it happens:** Drizzle ORM with Postgres text columns returns strings, not parsed values.

**How to avoid:** Always parse: `JSON.parse(firm.capabilityTags ?? "[]") as string[]`. The scorer already does this in `scoreCapabilityMatch`. The UI must also parse before rendering capability tag badges.

**Warning signs:** `capabilityTags.includes` throws "includes is not a function" — string has `includes`, but the comparison is wrong (looking for a word inside a JSON string, not an array element).

---

## Code Examples

### Scoring Weights Normalisation

```typescript
// Source: AI-SPEC.md §4 scoreAndRankCombinations
// Guard against all-zero weights (user set all sliders to 0)
const rawTotal = weights.contractRelevance + weights.ukOwnership + weights.partnerships + weights.riskFlags;
const wTotal = rawTotal === 0 ? 4 : rawTotal;  // equal-weight fallback
const w = {
  contractRelevance: weights.contractRelevance / wTotal,
  ukOwnership:       weights.ukOwnership / wTotal,
  partnerships:      weights.partnerships / wTotal,
  riskFlags:         weights.riskFlags / wTotal,
};
```

### Vitest Pure-Function Test Pattern

```typescript
// Source: AI-SPEC.md §4b.3 — tests run with no Postgres, no mocks
import { describe, it, expect } from "vitest";
import { buildConflictSet, hasConflict, scoreAndRankCombinations } from "../scorer";

describe("conflict exclusion", () => {
  it("excludes conflicted pair regardless of argument order", () => {
    const set = buildConflictSet([{ firmAId: "a", firmBId: "b", ...rest }]);
    expect(hasConflict(["b", "a", "c"], set)).toBe(true);  // order-independent
  });
});
```

### Zod 4 Response Validation in Route Handler

```typescript
// Source: AI-SPEC.md §4b.1 — .parse() on controlled scorer output (throws on contract violation)
const result = scoreAndRankCombinations(input);
const validated = RecommendResponseSchema.parse(result);  // bug if this throws
return NextResponse.json(validated);
```

### Staleness Badge Integration

```typescript
// Source: AI-SPEC.md §6 Guardrails — stale-data advisory
// Stale = lastResearchedAt is null OR older than 30 days
function isStaleFirm(firm: Firm): boolean {
  if (!firm.lastResearchedAt) return true;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 30);
  return new Date(firm.lastResearchedAt) < threshold;
}
// Surface this in FirmSubCard — existing staleness-badge component can be reused
```

### Capability Tag Badge (reusing existing pattern)

```typescript
// Source: src/components/firms/ownership-section.tsx — badge pattern (VERIFIED: file read)
// Existing capability tag color map from Phase 3 UI-SPEC
const CAPABILITY_COLORS: Record<string, string> = {
  Nuclear:        "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Consultancy:    "bg-violet-100 text-violet-700 border-violet-200",
};

function CapabilityTagBadge({ tag }: { tag: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs px-1.5 py-0.5 border", CAPABILITY_COLORS[tag] ?? "bg-neutral-100 text-neutral-500 border-neutral-200")}
    >
      {tag}
    </Badge>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix UI `asChild` pattern in shadcn | Base UI render-prop pattern (`render={<Link/>}`) | Phase 1 (shadcn 2025 upgrade) | All polymorphic shadcn components use `render={}`, not `asChild` — established in STATE.md decision [Plan 01-01] |
| SQLite for database | Postgres 16 via docker-compose | db-worker-upgrade branch | `DATABASE_URL` env var required; `docker compose up -d db` |
| `child_process.spawn()` for jobs | BullMQ + Redis | db-worker-upgrade branch | `docker compose up -d redis`; `npm run worker` |
| Zod v3 `.errors` | Zod v4 `.issues` (and `.flatten()` shape changes) | Phase 1 | `error.flatten()` used in API 400 responses; `.issues` not `.errors` on ZodError |

**Deprecated/outdated:**
- `app-sidebar.tsx`: Referenced in Plan 04-04 but **does not exist** in the codebase [VERIFIED: ls]. The actual nav component is `app-navbar.tsx`. Any plan referencing `app-sidebar.tsx` must use `app-navbar.tsx` instead.
- Zod v3 API patterns: Project is on Zod 4.4.3. Do not use `.refine()` result patterns that changed in v4.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Base Nova shadcn preset supports Slider, Accordion, and Card components via `npx shadcn add` | Standard Stack | Minor — if one component fails to install, use a simpler hand-rolled version for that component only |
| A2 | Shadcn add commands will work without interactive prompts in a CI/automated context | Standard Stack | Low — all three are standard shadcn components; documented in UI-SPEC |
| A3 | Direct import of `scoreAndRankCombinations` in the RSC `/report` page is preferred over HTTP `fetch` to `/api/recommend` | Architecture Patterns | Low — both approaches work; HTTP fetch adds a round-trip but is cleaner separation. Planner should decide. |
| A4 | 12 firms × 7 topics data is fully seeded in the Postgres DB (Phases 1-4 complete) before E9 integration test runs | Validation Architecture | High — if seeding is incomplete, E9 will return `no_valid_team` for the 1+1+1 default mix and the phase gate fails. Planner must include a "verify seeded DB" pre-check. |

**If this table is empty:** N/A — 4 assumptions identified.

---

## Open Questions

1. **Should Phase 4-04 deliverables be included in Phase 5 Wave 0 or deferred?**
   - What we know: Plan 04-04 was not executed. The `/analysis` page, conflict matrix, partnership table, and ownership rollup do not exist. The Analysis navbar entry is still disabled.
   - What's unclear: Whether the user wants Phase 5 to complete these Phase 4 deliverables (broader scope) or focus only on CONS-01 to CONS-05 and leave Analysis as a placeholder.
   - Recommendation: Include Phase 4-04 deliverables as Wave 0 in Phase 5. The Analysis nav link is a prerequisite for a coherent navbar, and the conflict matrix component may be partially reusable for the recommendation result's inline conflict display.

2. **Should `/report` call `/api/recommend` via HTTP fetch or import `scoreAndRankCombinations` directly?**
   - What we know: Both work. HTTP fetch adds a network round-trip in RSC (even same-process, Next.js may route through HTTP). Direct import reuses `src/lib/recommend/scorer.ts` directly.
   - What's unclear: Whether Next.js 16.x has limitations on same-process HTTP fetch in RSC that would require absolute URLs.
   - Recommendation: Import `scoreAndRankCombinations` and the DB layer directly in the RSC. Avoids HTTP overhead, avoids URL construction complexity, and allows the `/report` RSC to use the same Drizzle patterns as other RSC pages in this project.

3. **What staleness threshold should be used for the stale-data advisory?**
   - What we know: AI-SPEC defines a `staleFirmsInResult` count in the monitoring log. UI-SPEC references `staleness-badge` (existing component). No threshold is specified in CONTEXT.md.
   - What's unclear: Whether 30 days is the right threshold for conflict/ownership data freshness in this domain.
   - Recommendation: Default to 30 days (consistent with Phase 3's `staleness-badge` patterns). This is Claude's discretion per CONTEXT.md.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next.js dev | ✓ | v22.22.3 [VERIFIED: node --version] | — |
| npm | Package installs, scripts | ✓ | 10.9.8 [VERIFIED: npm --version] | — |
| Docker | Postgres + Redis via docker-compose | ✓ | 29.4.1 [VERIFIED: docker info] | — |
| Postgres (docker) | DB reads in route handler + E9 integration test | [ASSUMED: available via docker-compose] | 16 [from STATE.md] | Must run `docker compose up -d db` before E9 |
| Redis (docker) | BullMQ worker (not needed for Phase 5 scorer, only for existing research jobs) | [ASSUMED: available via docker-compose] | 7 [from CLAUDE.md] | Phase 5 scoring doesn't use BullMQ; Redis only needed if running full research pipeline for seeding |
| shadcn CLI | `npx shadcn add slider accordion card` | ✓ | 4.11.0 [VERIFIED: npm ls] | — |
| vitest | `npm test` | ✓ | 4.1.8 [VERIFIED: npm ls] | — |

**Missing dependencies with no fallback:**
- Postgres must be running for the E9 seeded integration test. Run `docker compose up -d db` before executing the integration test suite.

**Missing dependencies with fallback:**
- Redis is needed only to re-run the seeded research pipeline. If the DB is already seeded from previous research runs, Redis/worker are not needed to verify Phase 5.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (exists [VERIFIED]) |
| Quick run command | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts` |
| Full suite command | `npm test` (runs all test files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONS-01 | Capability mix + recommended team returned for 1+1+1 | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "scoreAndRankCombinations"` | Wave 0 |
| CONS-02 | Per-signal score breakdown present in every recommended firm | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "explainability"` | Wave 0 |
| CONS-03 | Conflicted pairs never co-recommended | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "conflict-exclusion"` | Wave 0 |
| CONS-04 | ownershipRecord non-null in breakdown regardless of weight | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "NSI"` | Wave 0 |
| CONS-05 | Locked firms always in result; lock-and-recompute returns different alternatives | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "locked"` | Wave 0 |
| E9 gate | Seeded 12×7 returns ok + valid schema | integration | `npx vitest run src/lib/recommend/__tests__/seeded-e2e.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/recommend/__tests__/scorer.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full `npm test` green + E9 seeded run passes + `/report` renders in browser without error

### Wave 0 Gaps (Files to Create)

- `src/lib/recommend/schemas.ts` — Zod request/response schemas
- `src/lib/recommend/scorer.ts` — pure scoring functions + `scoreAndRankCombinations()`
- `src/lib/recommend/combinations.ts` — `combinations<T>()` helper
- `src/lib/recommend/__tests__/scorer.test.ts` — E1–E8 pure-function evals
- `src/lib/recommend/__tests__/schemas.test.ts` — Zod boundary tests
- `src/lib/recommend/__tests__/seeded-e2e.test.ts` — E9 seeded 12×7 + snapshot

---

## Security Domain

> `security_enforcement` is not explicitly `false` in config.json — security domain applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — existing auth gates the entire app; Phase 5 adds no new auth surface | n/a |
| V3 Session Management | No — no new session state; Phase 5 reads are stateless per-request | n/a |
| V4 Access Control | No — Phase 5 API route is gated by same session middleware as all existing API routes [ASSUMED: existing middleware covers /api/recommend] | existing auth middleware |
| V5 Input Validation | Yes — `RecommendRequestSchema.safeParse()` validates all API input; `z.number().min(0).max(100)` on weights; `z.string().uuid()` on lockedFirmIds | Zod 4 `.safeParse()` |
| V6 Cryptography | No — no new crypto; scoring is arithmetic only | n/a |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed capabilityMix (negative counts, non-integer) | Tampering | `z.number().int().min(0).max(5)` on each capability field |
| Out-of-range weight values | Tampering | `z.number().min(0).max(100)` per weight; normalised server-side regardless |
| Non-UUID lockedFirmIds (path traversal via string injection) | Tampering | `z.array(z.string().uuid())` — rejects non-UUID strings before DB access |
| All-zero capabilityMix (no work to do, wasted DB reads) | Denial of Service (minor) | `.refine((mix) => Object.values(mix).some(v => v > 0))` in CapabilityMixSchema |
| Response contract violation (scorer bug leaks unexpected shape) | Information Disclosure | `RecommendResponseSchema.parse()` blocks malformed output before it reaches client |

**No new data ingestion:** Phase 5 only reads from existing DB tables. No user-supplied data is written to the DB. No injection vectors beyond the request body (mitigated by Zod).

---

## Project Constraints (from CLAUDE.md)

These directives apply to all Phase 5 implementation:

1. **No paid APIs, no restricted data** — Phase 5 has no external API calls; reads from local DB only. Compliant.
2. **AI research must cite sources** — Phase 5 recommendation output: any claim from a DB record must carry its source URL/title (already enforced by existing schema fields). The scorer surfaces `ownershipRecord.sourceUrl`, `riskFlags[n].sourceUrl`, `partnershipPairs[n].sourceUrl` in the breakdown.
3. **No new dependencies without justification** — Three shadcn component installs (slider, accordion, card) are justified: they replace hand-rolled alternatives and match the design system. No new npm packages in `dependencies` or `devDependencies`.
4. **CLAUDE.md Technology Stack must be followed** — Next.js App Router, Drizzle/Postgres, Vitest, shadcn/ui, Zod. No new framework. Compliant.
5. **Run full test suite before committing** — `npm test` must pass; CLAUDE.md §Commit Workflow.
6. **PENDING_RELEASE.md and RELEASE_NOTES.md updated per commit** — planner must add tasks to update these files.
7. **Never push directly to main** — work on `gsd/v1.0-milestone` (current branch [VERIFIED: git status]).
8. **GSD workflow enforcement** — changes go through `gsd-execute-phase`, not direct file edits.

---

## Sources

### Primary (HIGH confidence)

- `05-AI-SPEC.md` — Algorithm design, scoring functions, Zod schemas, Vitest eval strategy, all code examples [VERIFIED: file read]
- `05-CONTEXT.md` — Locked decisions D-01 through D-11, integration points, deferred items [VERIFIED: file read]
- `05-UI-SPEC.md` — Component inventory, copywriting contract, route architecture, shadcn component list [VERIFIED: file read]
- `src/db/schema.ts` — Exact column names and types for all tables the scorer reads [VERIFIED: file read]
- `src/lib/types.ts` — `Firm`, `ConflictPair`, `PartnershipPair`, `OwnershipRecord`, `RiskFlag`, `ProcurementRecord` types [VERIFIED: file read]
- `src/components/app-navbar.tsx` — Current navbar structure, `NAV_ITEMS` vs `PLACEHOLDER_ITEMS` state [VERIFIED: file read]
- `src/lib/cross-cutting/conflicts.ts` — Established multi-table Drizzle read pattern, canonical pair ordering [VERIFIED: file read]
- `src/components/firms/ownership-section.tsx` — Existing ownership badge pattern to reuse [VERIFIED: file read]
- `src/components/firms/firm-conflicts-list.tsx` — Existing conflict badge pattern to reuse [VERIFIED: file read]
- `vitest.config.ts` — Test framework config, `@` alias, environment: node [VERIFIED: file read]
- `.planning/phases/04-cross-cutting-analysis/04-04-PLAN.md` — Phase 4-04 scope, not yet executed [VERIFIED: file read + no SUMMARY.md found]

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — Technology stack, commit workflow, security constraints [VERIFIED: file read]
- `.planning/STATE.md` — db-worker-upgrade decisions, current phase status [VERIFIED: file read]
- `.planning/REQUIREMENTS.md` — CONS-01 through CONS-05 requirement text [VERIFIED: file read]
- `package.json` — All installed package versions [VERIFIED: npm ls]

### Tertiary (LOW confidence)

- [ASSUMED] shadcn base-nova preset supports Slider, Accordion, Card components — standard components but not verified against the specific preset in this session

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all package versions verified via `npm ls`; no new packages beyond shadcn components
- Architecture: HIGH — route patterns verified from existing codebase files; AI-SPEC provides complete algorithmic design
- Pitfalls: HIGH — all pitfalls derive from verified codebase observations (route group mismatch confirmed by ls; Phase 4-04 incompleteness confirmed by missing SUMMARY.md and missing files)
- Phase 4-04 gap: HIGH — confirmed by absence of `src/app/(app)/analysis/`, `src/components/analysis/`, and `04-04-SUMMARY.md`

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (stable stack — no fast-moving dependencies)
