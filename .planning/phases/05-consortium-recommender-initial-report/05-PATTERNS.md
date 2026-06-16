# Phase 5: Consortium Recommender + Initial Report — Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 15 new/modified files
**Analogs found:** 13 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/recommend/schemas.ts` | utility/schema | transform | `src/lib/cross-cutting/schemas.ts` | exact |
| `src/lib/recommend/scorer.ts` | utility/service | transform | `src/lib/cross-cutting/conflicts.ts` (pure helper pattern) | role-match |
| `src/lib/recommend/combinations.ts` | utility | transform | `src/lib/adapters/ocds.ts` (pure transform) | role-match |
| `src/app/api/recommend/route.ts` | route/controller | request-response | `src/app/api/research/run/route.ts` | exact |
| `src/app/(app)/recommend/page.tsx` | component/page | request-response | `src/app/(app)/firms/page.tsx` | role-match |
| `src/app/(app)/report/page.tsx` | component/page | request-response | `src/app/(app)/firms/page.tsx` | role-match |
| `src/components/recommend/capability-mix-input.tsx` | component | event-driven | `src/components/firms/firm-form-dialog.tsx` | role-match |
| `src/components/recommend/weight-sliders.tsx` | component | event-driven | `src/components/firms/firm-form-dialog.tsx` | role-match |
| `src/components/recommend/lock-firms-section.tsx` | component | event-driven | `src/components/firms/firms-table.tsx` | partial-match |
| `src/components/recommend/recommendation-result.tsx` | component | request-response | `src/components/firms/firm-profile-page.tsx` | role-match |
| `src/components/recommend/firm-sub-card.tsx` | component | request-response | `src/components/firms/firm-conflicts-list.tsx` + `ownership-section.tsx` | role-match |
| `src/components/recommend/score-breakdown.tsx` | component | transform | `src/components/firms/risk-flags-section.tsx` | role-match |
| `src/components/recommend/no-valid-team-state.tsx` | component | — | `src/app/(app)/firms/page.tsx` (empty state) | role-match |
| `src/lib/recommend/__tests__/scorer.test.ts` | test | — | `src/lib/cross-cutting/__tests__/conflicts.test.ts` | exact |
| `src/components/app-navbar.tsx` | component | event-driven | self (modify existing) | self |

---

## Pattern Assignments

### `src/lib/recommend/schemas.ts` (utility/schema, transform)

**Analog:** `src/lib/cross-cutting/schemas.ts`

**Critical rule:** NO `"server-only"` import — must be importable by Vitest in Node environment without Next.js modules. Mirrors the comment block at the top of `src/lib/cross-cutting/schemas.ts` line 1–10.

**Imports pattern** (lines 1–3 of analog):
```typescript
import { z } from "zod";
```

**Core schema pattern** (lines 18–50 and 128–190 of analog):
```typescript
// Use z.object() with .describe() on each field for documentation
// Use z.enum() for constrained string fields
// Use z.discriminatedUnion() for the response shape (Zod 4 pattern)
export const RecommendRequestSchema = z.object({
  capabilityMix: z.object({
    Consultancy: z.number().int().min(0).max(5),
    Infrastructure: z.number().int().min(0).max(5),
    Nuclear: z.number().int().min(0).max(5),
  }).refine((mix) => Object.values(mix).some((v) => v > 0), {
    message: "At least one capability must be > 0",
  }),
  lockedFirmIds: z.array(z.string().uuid()),
  weights: z.object({
    contractRelevance: z.number().min(0).max(100),
    ukOwnership: z.number().min(0).max(100),
    partnerships: z.number().min(0).max(100),
    riskFlags: z.number().min(0).max(100),
  }),
});

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

**Export type pattern** (lines 50–51 of analog):
```typescript
export type RecommendRequest = z.infer<typeof RecommendRequestSchema>;
export type RecommendResponse = z.infer<typeof RecommendResponseSchema>;
```

---

### `src/lib/recommend/scorer.ts` (utility/service, transform)

**Analog:** `src/lib/cross-cutting/conflicts.ts` (pure-helper section), `src/lib/cross-cutting/schemas.ts`

**Critical rule:** NO DB imports — pure functions only. All DB data is passed in as plain arrays. This mirrors the separation in `conflicts.ts` where `canonicalPair()` and `resolveFirmName()` are exported standalone helpers (lines 39–85).

**File-level doc comment pattern** (lines 1–16 of `conflicts.ts`):
```typescript
/**
 * Consortium scoring engine (Phase 5).
 *
 * Pure function — no DB calls, no Next.js imports. All signal data is
 * passed in as plain arrays by the route handler.
 *
 * Key invariants:
 * - Conflict exclusion applied before scoring (never after)
 * - ownershipRecord always populated in FirmScoreBreakdown regardless of weight
 * - Tie-breaking is alphabetical by firm canonicalName
 *
 * NO "server-only" import — must be importable by Vitest in Node environment.
 */
```

**Imports pattern:**
```typescript
import type { Firm, ConflictPair, PartnershipPair, OwnershipRecord, RiskFlag, ProcurementRecord } from "@/lib/types";
import type { RecommendRequest, RecommendResponse, FirmScoreBreakdown } from "./schemas";
```

**Core pure-function pattern** (analogous to `canonicalPair` at lines 39–41 of `conflicts.ts`):
```typescript
// Small named helper functions, each exported for direct test access
export function buildConflictSet(conflicts: ConflictPair[]): Set<string> {
  const set = new Set<string>();
  for (const c of conflicts) {
    set.add([c.firmAId, c.firmBId].sort().join("__"));
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

**Weights normalisation pattern** (from RESEARCH.md §Code Examples):
```typescript
const rawTotal = weights.contractRelevance + weights.ukOwnership + weights.partnerships + weights.riskFlags;
const wTotal = rawTotal === 0 ? 4 : rawTotal;  // equal-weight fallback
const w = {
  contractRelevance: weights.contractRelevance / wTotal,
  ukOwnership:       weights.ukOwnership / wTotal,
  partnerships:      weights.partnerships / wTotal,
  riskFlags:         weights.riskFlags / wTotal,
};
```

**capabilityTags parsing pattern** (Pitfall 7 from RESEARCH.md):
```typescript
// firms.capabilityTags is a text column — always parse before use
const tags = JSON.parse(firm.capabilityTags ?? "[]") as string[];
```

---

### `src/lib/recommend/combinations.ts` (utility, transform)

**Analog:** No direct analog — simple recursive helper. Use standard recursive pattern.

**Pattern:**
```typescript
/**
 * Generate all k-length combinations from arr.
 * C(12,3) = 220 — safe to enumerate at this scale.
 */
export function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  const withHead = combinations(tail, k - 1).map((combo) => [head, ...combo]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}
```

---

### `src/app/api/recommend/route.ts` (route/controller, request-response)

**Analog:** `src/app/api/research/run/route.ts` (lines 1–47) — exact match.

**Imports pattern** (lines 1–7 of analog):
```typescript
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { firms, conflictPairs, partnershipPairs, ownershipRecords, riskFlags, procurementRecords } from "@/db/schema";
import { RecommendRequestSchema, RecommendResponseSchema } from "@/lib/recommend/schemas";
import { scoreAndRankCombinations } from "@/lib/recommend/scorer";
```

**Zod safeParse + 400 error pattern** (lines 26–34 of analog):
```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RecommendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { capabilityMix, lockedFirmIds, weights } = parsed.data;
```

**Parallel DB reads pattern** (architectural, from RESEARCH.md §Pattern 1):
```typescript
  const [allFirms, allConflicts, allPartnerships, allOwnership, allRiskFlags, allProcurement] =
    await Promise.all([
      db.select().from(firms),
      db.select().from(conflictPairs),
      db.select().from(partnershipPairs),
      db.select().from(ownershipRecords),
      db.select().from(riskFlags),
      db.select().from(procurementRecords),
    ]);
```

**Service call + response pattern** (lines 37–47 of analog):
```typescript
  const result = scoreAndRankCombinations({
    capabilityMix, lockedFirmIds, weights,
    firms: allFirms, conflicts: allConflicts, partnerships: allPartnerships,
    ownership: allOwnership, riskFlags: allRiskFlags, procurement: allProcurement,
  });

  // .parse() (not .safeParse()) — throws if scorer output breaks the contract (that's a bug)
  const validated = RecommendResponseSchema.parse(result);
  return NextResponse.json(validated);
```

**Error catch pattern** (lines 38–43 of analog):
```typescript
  try {
    // ... service call
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
```

---

### `src/app/(app)/recommend/page.tsx` (component/page, request-response)

**Analog:** `src/app/(app)/firms/page.tsx` (lines 1–46) for RSC page structure.

**Note:** `/recommend` is a `"use client"` component (client state: mix counters, lock selections, weights, result). It is NOT an RSC like firms/page.tsx. Firms page provides the surrounding layout pattern only.

**Page layout shell pattern** (lines 14–45 of `firms/page.tsx`):
```tsx
<main className="flex flex-col min-h-full">
  {/* Page header */}
  <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
    <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
      Consortium Recommender
    </h1>
  </header>

  {/* Content */}
  <div className="flex-1 px-6 py-6">
    {/* ... */}
  </div>
</main>
```

**`dynamic = "force-dynamic"` pattern** (line 7 of `firms/page.tsx`):
```typescript
export const dynamic = "force-dynamic";
```
Note: Not needed for the `"use client"` recommend page, but apply to `report/page.tsx`.

---

### `src/app/(app)/report/page.tsx` (component/page, request-response)

**Analog:** `src/app/(app)/firms/page.tsx` — RSC with direct DB/service import pattern.

**Note from RESEARCH.md §Open Questions Q2:** Prefer direct import of `scoreAndRankCombinations` + DB layer over HTTP fetch to avoid round-trip. Mirrors firms/page.tsx which imports `db` directly.

**RSC pattern with force-dynamic** (lines 1–11 of `firms/page.tsx`):
```typescript
import { db } from "@/db/client";
import { firms, conflictPairs, partnershipPairs, ownershipRecords, riskFlags, procurementRecords } from "@/db/schema";
import { scoreAndRankCombinations } from "@/lib/recommend/scorer";
import { RecommendationResult } from "@/components/recommend/recommendation-result";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const [allFirms, allConflicts, ...] = await Promise.all([...]);
  const result = scoreAndRankCombinations({
    capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
    lockedFirmIds: [],
    weights: { contractRelevance: 25, ukOwnership: 25, partnerships: 25, riskFlags: 25 },
    firms: allFirms, conflicts: allConflicts, ...
  });
  // render result read-only (no sliders, no lock section, no recompute button)
}
```

**Page layout:** Use same `<main>` / `<header>` / `<div className="flex-1 px-6 py-6">` shell from `firms/page.tsx` lines 14–45.

---

### `src/components/recommend/firm-sub-card.tsx` (component, request-response)

**Analog:** `src/components/firms/firm-conflicts-list.tsx` + `src/components/firms/ownership-section.tsx`

**Conflict badge pattern** (lines 10–22 of `firm-conflicts-list.tsx`):
```tsx
// Red badge for intra-team conflict
<Badge
  variant="outline"
  className={cn(
    "text-xs font-normal px-1.5 py-0.5 border shrink-0",
    "bg-red-100 text-red-700 border-red-200",
  )}
>
  {conflictType === "audit" ? "Audit" : "Competitor"}
</Badge>
```

**Ownership badge pattern** (lines 10–35 of `ownership-section.tsx`):
```tsx
// Green for UK, amber for foreign ISO code
const isUK = country.toUpperCase() === "UK";
<Badge
  variant="outline"
  className={cn(
    "text-xs font-mono px-1.5 py-0.5 border",
    isUK
      ? "bg-green-100 text-green-700 border-green-200"
      : "bg-amber-100 text-amber-700 border-amber-200",
  )}
>
  {isUK ? "UK" : country.toUpperCase()}
</Badge>
```

**Capability tag badge pattern** (from RESEARCH.md §Code Examples):
```typescript
const CAPABILITY_COLORS: Record<string, string> = {
  Nuclear:        "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Consultancy:    "bg-violet-100 text-violet-700 border-violet-200",
};
```

**Source link pattern** (lines 105–114 of `firm-conflicts-list.tsx`):
```tsx
{sourceUrl && sourceUrl !== "not-found" && (
  <a
    href={sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-0.5 text-xs text-blue-600 underline"
  >
    Source
    <ExternalLink className="h-3 w-3 ml-0.5" />
  </a>
)}
```

**Card item shell pattern** (lines 88–119 of `firm-conflicts-list.tsx`):
```tsx
<div className="border border-neutral-200 rounded-lg p-4 flex gap-3">
  {/* badge */}
  <div className="flex flex-col gap-1 min-w-0">
    {/* name, details, source link */}
  </div>
</div>
```

---

### `src/components/recommend/score-breakdown.tsx` (component, transform)

**Analog:** `src/components/firms/risk-flags-section.tsx` (lines 1–128)

**Severity badge + sorted list pattern** (lines 10–33, 84–127 of `risk-flags-section.tsx`):
```typescript
// Severity styles map — reuse for score signal indicator
const SEVERITY_STYLES: Record<RiskFlag["severity"], string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-neutral-100 text-neutral-600 border-neutral-200",
};
```

**Structured DL layout from `ownership-section.tsx`** (lines 133–196):
```tsx
<dl className="flex flex-col gap-3">
  <div className="flex items-center gap-3">
    <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 w-44 shrink-0">
      Signal
    </dt>
    <dd className="text-sm text-neutral-700">Score</dd>
  </div>
</dl>
```

---

### `src/components/recommend/no-valid-team-state.tsx` (component, —)

**Analog:** `src/app/(app)/firms/page.tsx` empty state (lines 26–41)

**Empty state pattern** (lines 26–41 of `firms/page.tsx`):
```tsx
<div className="flex flex-col items-center justify-center py-24 text-center">
  <div className="mb-4 rounded-full bg-neutral-100 p-4">
    <Users className="h-8 w-8 text-neutral-400" />
  </div>
  <h2 className="text-xl font-semibold text-neutral-700 mb-2">
    No valid team found
  </h2>
  <p className="text-sm text-neutral-500 max-w-sm mb-6">
    {reason}
  </p>
</div>
```

---

### `src/lib/recommend/__tests__/scorer.test.ts` + `schemas.test.ts` + `seeded-e2e.test.ts` (test)

**Analog:** `src/lib/cross-cutting/__tests__/conflicts.test.ts` (lines 1–393) — exact structural match.

**Test file structure pattern** (lines 1–25 of `conflicts.test.ts`):
```typescript
/**
 * Unit tests for [module].
 *
 * Tests must run without ANTHROPIC_API_KEY / DB connection.
 * All external dependencies mocked via vi.mock().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
```

**Fixture data pattern** (lines 20–100 of `conflicts.test.ts`):
```typescript
// Named constants for fixture IDs — makes test intent readable
const FIRM_A = "firm-aardvark";
const FIRM_B = "firm-zebra";

const MOCK_FIRMS = [
  { id: FIRM_A, canonicalName: "Aardvark Nuclear Ltd", capabilityTags: '["Nuclear"]', ... },
  { id: FIRM_B, canonicalName: "Zebra Infra Ltd", capabilityTags: '["Infrastructure"]', ... },
];
```

**vi.mock DB pattern** (lines 114–138 of `conflicts.test.ts`):
```typescript
// For pure-function scorer tests: NO DB mock needed — pass plain arrays directly.
// The scorer takes plain object arrays, so no vi.mock("@/db/client") required for unit tests.
// DB mock only needed for seeded-e2e.test.ts integration test.
```

**beforeEach reset pattern** (lines 218–224 of `conflicts.test.ts`):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockFn.mockReset();
});
```

**describe + it naming pattern** (lines 230–297 of `conflicts.test.ts`):
```typescript
describe("buildConflictSet + hasConflict — exclusion invariants", () => {
  it("excludes conflicted pair regardless of argument order", () => { ... });
  it("returns false when no conflicts exist", () => { ... });
});

describe("scoreAndRankCombinations — CONS-01 basic output", () => {
  it("returns ok status with 1+1+1 valid team from 3-firm fixture", () => { ... });
});
```

---

### `src/components/app-navbar.tsx` (component, event-driven) — modify existing

**Analog:** Self — modify in place.

**Current NAV_ITEMS pattern** (lines 25–35 of `app-navbar.tsx`):
```typescript
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Firms", href: "/firms", icon: Building2 },
  { label: "Topics", href: "/topics", icon: BookOpen },
  { label: "Jobs", href: "/jobs", icon: Activity },
];

const PLACEHOLDER_ITEMS: NavItem[] = [
  { label: "Analysis", href: "#", icon: BarChart3, disabled: true },
  { label: "Consortium", href: "#", icon: Users, disabled: true },
];
```

**Required change:** Move "Consortium" from PLACEHOLDER_ITEMS to NAV_ITEMS as "Recommend", add "Report". Add `FileText` to lucide-react imports (line 13 of `app-navbar.tsx`).

**Nav Link render pattern** (lines 60–78 of `app-navbar.tsx`):
```tsx
<Link
  key={item.href}
  href={item.href}
  className={cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
    isActive
      ? "bg-white/10 text-white"
      : "text-white/55 hover:text-white hover:bg-white/8"
  )}
>
  <item.icon className="h-4 w-4 shrink-0" />
  {item.label}
</Link>
```

Note: Nav uses standard `<Link>` (not shadcn Button), so the Base UI `render={}` pattern does NOT apply here.

---

## Shared Patterns

### "server-only" Import Rule
**Source:** `src/app/api/research/run/route.ts` line 1; `src/lib/cross-cutting/conflicts.ts` lines 15–16 (absence of it)
**Apply to:** ALL new files

- Route handlers (`src/app/api/**`) — ADD `import "server-only"` as first line
- Lib modules (`src/lib/recommend/**`) — DO NOT add `"server-only"` — must be importable by Vitest
- Components (`src/components/recommend/**`) — DO NOT add `"server-only"`

### Zod `safeParse` vs `parse` Rule
**Source:** `src/app/api/research/run/route.ts` lines 27–29
**Apply to:** `src/app/api/recommend/route.ts`

```typescript
// Untrusted input (request body) — use safeParse, return 400 on failure
const parsed = RecommendRequestSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.message }, { status: 400 });
}

// Controlled output (scorer result) — use parse, throw on failure (that's a bug)
const validated = RecommendResponseSchema.parse(result);
```

### `@/` Path Alias
**Source:** All existing files — `import { db } from "@/db/client"`, `import { cn } from "@/lib/utils"`
**Apply to:** All new files — use `@/` alias, never relative paths with `../../../`.

### Badge Import
**Source:** `src/components/firms/firm-conflicts-list.tsx` line 3, `ownership-section.tsx` line 3
**Apply to:** `src/components/recommend/firm-sub-card.tsx`, `score-breakdown.tsx`
```typescript
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
```

### Section Layout Shell
**Source:** `src/components/firms/firm-conflicts-list.tsx` lines 75–78, `ownership-section.tsx` lines 129–131
**Apply to:** All `src/components/recommend/` components that are standalone sections
```tsx
<section className="px-6 py-6 border-t border-neutral-200">
  <h2 className="text-xl font-semibold text-neutral-900 mb-4">Section Title</h2>
  {/* content */}
</section>
```

### Empty State + "Not researched" Pattern
**Source:** `src/components/firms/firm-conflicts-list.tsx` lines 53–65, `risk-flags-section.tsx` lines 71–80
**Apply to:** `src/components/recommend/no-valid-team-state.tsx`

Always provide an explicit message, never silent empty. Pattern:
```tsx
if (noData) {
  return (
    <section className="px-6 py-6 border-t border-neutral-200">
      <h2>...</h2>
      <p className="text-sm text-neutral-500">Explicit explanation copy.</p>
    </section>
  );
}
```

### External Link Safety
**Source:** `src/components/firms/firm-conflicts-list.tsx` lines 105–114, `ownership-section.tsx` lines 173–182
**Apply to:** `src/components/recommend/firm-sub-card.tsx`, `score-breakdown.tsx`
```tsx
target="_blank"
rel="noopener noreferrer"
```
Always check `sourceUrl !== "not-found"` before rendering the link.

### `force-dynamic` on Data Pages
**Source:** `src/app/(app)/firms/page.tsx` line 7
**Apply to:** `src/app/(app)/report/page.tsx`
```typescript
export const dynamic = "force-dynamic";
```

### Base UI Render-Prop (NOT asChild)
**Source:** STATE.md decision [Plan 01-01] — verified in RESEARCH.md §Pattern 4
**Apply to:** Any shadcn polymorphic component (`Button`, `SidebarMenuButton`) that wraps a `<Link>`
```tsx
// CORRECT
<Button render={<Link href="/recommend" />}>Get Recommendation</Button>
// WRONG — Radix pattern not used in this project
<Button asChild><Link href="/recommend">...</Link></Button>
```
Note: The plain `<Link>` in `app-navbar.tsx` (line 65–78) is NOT a shadcn Button — it does not use asChild or render prop.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/recommend/combinations.ts` | utility | transform | No combinatorial generator exists in codebase; straightforward recursive helper — use standard pattern |
| `src/components/recommend/weight-sliders.tsx` | component | event-driven | Slider (shadcn) not yet installed; no slider component in codebase. Install first: `npx shadcn add slider` |

---

## Critical Pitfalls (for Planner Reference)

These are verified against the actual codebase and must appear in plan guardrails:

1. **Route group** — New pages MUST go in `src/app/(app)/`, not `src/app/`. API routes go in `src/app/api/` (no route group). Verified: `src/app/(app)/firms/page.tsx` exists; `src/app/api/research/run/route.ts` is outside the group.
2. **No `"server-only"` in lib schemas** — `src/lib/cross-cutting/schemas.ts` explicitly omits it so Vitest can import. Same rule applies to `src/lib/recommend/schemas.ts` and `scorer.ts`.
3. **capabilityTags is a JSON string** — `firms.capabilityTags` is a `text` column. Always `JSON.parse(firm.capabilityTags ?? "[]")` before use. See `conflicts.ts` line 71 for the aliases parsing pattern.
4. **Phase 4-04 deliverables not executed** — `src/components/analysis/` directory does not exist; `src/app/(app)/analysis/page.tsx` does not exist. The Analysis navbar link is still disabled. Planner must decide: include as Wave 0 or leave as placeholder.
5. **shadcn not yet installed** — `slider`, `accordion`, and `card` are not in `src/components/ui/`. Must `npx shadcn add slider accordion card` before implementing components that depend on them.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/lib/`
**Files scanned:** 15 analog files read
**Pattern extraction date:** 2026-06-16
