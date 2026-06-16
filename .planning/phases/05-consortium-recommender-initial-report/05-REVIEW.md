---
phase: 05-consortium-recommender-initial-report
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/lib/recommend/schemas.ts
  - src/lib/recommend/combinations.ts
  - src/lib/recommend/scorer.ts
  - src/app/api/recommend/route.ts
  - src/lib/recommend/__tests__/schemas.test.ts
  - src/lib/recommend/__tests__/scorer.test.ts
  - src/components/recommend/capability-mix-input.tsx
  - src/components/recommend/weight-sliders.tsx
  - src/components/recommend/lock-firms-section.tsx
  - src/components/recommend/firm-sub-card.tsx
  - src/components/recommend/score-breakdown.tsx
  - src/components/recommend/no-valid-team-state.tsx
  - src/components/recommend/recommendation-result.tsx
  - src/app/(app)/recommend/page.tsx
  - src/app/(app)/recommend/recommend-client.tsx
  - src/lib/queries/lock-firms.ts
  - src/components/app-navbar.tsx
  - src/app/(app)/report/page.tsx
  - src/lib/recommend/__tests__/seeded-e2e.test.ts
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The Phase 5 consortium recommender is well-structured overall: the scorer is a clean pure function, the schema is correct, and the route handler validates both input and output. However there are three blockers — two are silent data-loss / incorrect-results bugs in the scoring engine, and one is a logic gap that allows unvalidated locked firm IDs to silently vanish from results without any user feedback. Six warnings cover UI misinformation (a column rendered with the wrong signal), a state-management hole in the reset flow, an oversize team-size explosion risk with no guard, and several reliability gaps. Three info items flag dead code.

---

## Critical Issues

### CR-01: `coversAll` capability check does not enforce slot multiplicity — teams with duplicate-slot requests are accepted when only one firm covers the tag

**File:** `src/lib/recommend/scorer.ts:235`

**Issue:** `requiredSlots` is built by repeating each tag `count` times, e.g. a `{ Nuclear: 2, Consultancy: 1 }` mix produces `["Nuclear","Nuclear","Consultancy"]`. The team coverage check then calls:

```ts
const coversAll = requiredSlots.every((slot) => teamTags.includes(slot));
```

`Array.prototype.includes` is a membership test, not a multiset check. A single firm with `["Nuclear"]` in its tags satisfies *both* `"Nuclear"` slots because `teamTags.includes("Nuclear")` is true for every duplicate element. A 2-Nuclear mix therefore passes with a team that has only one Nuclear firm — the multiplicity constraint is silently dropped.

**Fix:** Count how many times each tag appears in `teamTags` and compare against the required count.

```ts
// Replace the coversAll check with a multiset check
const teamTagCounts: Record<string, number> = {};
for (const tag of teamTags) {
  teamTagCounts[tag] = (teamTagCounts[tag] ?? 0) + 1;
}
const slotCounts: Record<string, number> = {};
for (const slot of requiredSlots) {
  slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
}
const coversAll = Object.entries(slotCounts).every(
  ([tag, needed]) => (teamTagCounts[tag] ?? 0) >= needed,
);
```

---

### CR-02: `lockedFirmIds` that do not match any row in `firms` are silently discarded — locked firms are dropped from results without error

**File:** `src/app/api/recommend/route.ts:48-65` and `src/lib/recommend/scorer.ts:208`

**Issue:** The route validates that each element of `lockedFirmIds` is a UUID (schema check), but never verifies those UUIDs exist in the `allFirms` array loaded from the DB. Inside the scorer:

```ts
const lockedFirms = allFirms.filter((f) => lockedFirmIds.includes(f.id));
```

If a locked firm ID matches no DB row (stale ID, wrong tenant, row deleted), `lockedFirms` will be shorter than `lockedFirmIds`. The scorer silently proceeds with `slotsToFill = teamSize - lockedFirms.length`, generating teams that no longer contain the requested firm. CONS-05 ("lockedFirmIds always appear in every recommended team") is violated without any 4xx response or error message. A user locking a firm they just deleted will get quietly wrong results.

**Fix:** In the route handler, after loading `allFirms`, validate that all locked IDs resolve:

```ts
const allFirmIds = new Set(allFirms.map((f) => f.id));
const missingIds = lockedFirmIds.filter((id) => !allFirmIds.has(id));
if (missingIds.length > 0) {
  return NextResponse.json(
    { error: "One or more locked firm IDs do not exist", missingIds },
    { status: 422 },
  );
}
```

---

### CR-03: `teamHasPriorPartnerships` is called twice per team in the final map — redundant O(n²) work and a correctness risk if result state ever diverges

**File:** `src/lib/recommend/scorer.ts:272-312`

**Issue:** For each scored team, `teamHasPriorPartnerships` is called once inside the scoring loop (line 272) to compute `partnershipBonus` that feeds into `teamScore`, and then called again inside the `.slice(0, 3).map(...)` at line 309 to populate `hasPriorPartnerships` on the returned `TeamRecommendation`. The two calls are logically required to agree — and currently do — but the double-computation is wasteful and creates a latent inconsistency risk if either call site is modified independently. The result already has `partnershipBonus` derived from the first call; the second call is dead redundancy.

**Fix:** Store the boolean from the first call and reuse it:

```ts
// Inside the combination loop:
const hasPriorPartnerships = teamHasPriorPartnerships(teamIds, partnerships);
const partnershipBonus = hasPriorPartnerships ? w.partnerships : 0;
const teamScore = meanFirmScore + partnershipBonus;
scoredTeams.push({ team: teamFirms, score: teamScore, breakdown, hasPriorPartnerships });

// In the final map:
recommendations: scoredTeams.slice(0, 3).map((s, idx) => ({
  rank: idx + 1,
  score: s.score,
  firms: s.breakdown,
  hasPriorPartnerships: s.hasPriorPartnerships,  // no second call
})),
```

---

## Warnings

### WR-01: `ScoreBreakdown` table "Partnerships" column renders `capabilityMatch` signal — data is mislabelled

**File:** `src/components/recommend/score-breakdown.tsx:39-51`

**Issue:** The column header is `Partnerships` but the cell renders `firm.signalScores.capabilityMatch`:

```tsx
<th ...>Partnerships</th>
...
<td ...>{(firm.signalScores.capabilityMatch * 100).toFixed(0)}</td>
```

`FirmScoreBreakdownSchema` does not include a per-firm `partnerships` signal score (partnerships is a team-level bonus, not a per-firm score), but the column label promises it. Users reading the score breakdown table will see the capability-match percentage labelled as "Partnerships" — a factually wrong display that undermines the explainability goal.

**Fix:** Rename the column header to match the data it actually renders:

```tsx
<th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Capability</th>
```

Or drop the column and surface `team.hasPriorPartnerships` as a team-level badge instead.

---

### WR-02: `handleReset` in `RecommendClient` clears `lockedFirmIds` but does not clear `result` — stale recommendation stays on screen after reset

**File:** `src/app/(app)/recommend/recommend-client.tsx:94-96`

**Issue:**

```ts
function handleReset() {
  setLockedFirmIds([]);
}
```

`result` state is not cleared. After the user clicks "Reset", the previous recommendation remains visible even though the locked-firms configuration has changed. The user sees a recommendation that no longer reflects the current form state.

**Fix:**

```ts
function handleReset() {
  setLockedFirmIds([]);
  setResult(null);
}
```

---

### WR-03: No cap on `teamSize` — `capabilityMix` values up to 5 each allow a 15-firm team, which generates `C(N,12)` combinations and can cause DoS or timeout

**File:** `src/lib/recommend/scorer.ts:205` and `src/lib/recommend/schemas.ts:13-21`

**Issue:** The schema permits up to 5 per capability and the mix has 3 capability keys, so `teamSize` can reach 15. With a modest 15-firm pool, `C(15,15) = 1` but with 20 firms `C(20,12) = 125,970` combinations. The schema's max-per-slot of 5 is not validated against a *total* team size limit. A legitimate user requesting `{Consultancy:5, Infrastructure:5, Nuclear:5}` triggers 125,970+ scored teams (each running 4 signal scorers) synchronously inside a Next.js route handler. This can exhaust the route's CPU time and cause a hard timeout.

**Fix:** Add a total-team-size guard in the schema:

```ts
export const CapabilityMixSchema = z
  .object({
    Consultancy: z.number().int().min(0).max(5),
    Infrastructure: z.number().int().min(0).max(5),
    Nuclear: z.number().int().min(0).max(5),
  })
  .refine((mix) => Object.values(mix).some((v) => v > 0), {
    message: "At least one capability slot must be requested",
  })
  .refine((mix) => mix.Consultancy + mix.Infrastructure + mix.Nuclear <= 6, {
    message: "Total team size cannot exceed 6",
  });
```

---

### WR-04: `report/page.tsx` calls `scoreAndRankCombinations` directly in an RSC with no try/catch — an unhandled scorer or schema exception causes an unhandled render error with no user-facing message

**File:** `src/app/(app)/report/page.tsx:68-86`

**Issue:**

```ts
const result = scoreAndRankCombinations({ ... });
const validatedResult = RecommendResponseSchema.parse(result); // throws ZodError on contract violation
```

Neither call is wrapped in try/catch. If the scorer throws (malformed `capabilityTags` JSON in the DB, programming contract violation detected by Zod parse, etc.) the entire RSC render will throw, propagating to the Next.js error boundary. There is no structured error state: the user sees an unformatted error page. The route handler (`route.ts`) handles this correctly with try/catch; the RSC page does not.

**Fix:** Wrap the scorer call:

```ts
let validatedResult;
try {
  const result = scoreAndRankCombinations({ ... });
  validatedResult = RecommendResponseSchema.parse(result);
} catch (err) {
  // Render a graceful error state
  return <ErrorState message="Could not compute report. Check server logs." />;
}
```

---

### WR-05: `getLockFirmsList` does not guard against malformed `capabilityTags` JSON — a single bad DB row throws `JSON.parse` and crashes the RSC page

**File:** `src/lib/queries/lock-firms.ts:35`

**Issue:**

```ts
tags: JSON.parse(row.capabilityTags ?? "[]") as string[],
```

If any row's `capabilityTags` column contains non-JSON text (data migration artefact, manual edit, corruption), `JSON.parse` throws a `SyntaxError`. Because this runs inside the RSC `RecommendPage`, the entire page crashes. The same pattern exists in `scorer.ts` lines 64, 233, and 265. The DB schema defines `capabilityTags` as `notNull().default("[]")` but that only guards against SQL-level nulls, not malformed strings inserted by other paths.

**Fix:** Wrap parse with a fallback:

```ts
function safeParseTags(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

Apply `safeParseTags` in `getLockFirmsList`, `scoreCapabilityMatch`, and the two inline `JSON.parse` calls in `scoreAndRankCombinations`.

---

### WR-06: `getConflictsForFirm` in `recommendation-result.tsx` accepts `teamFirmIds` and `firmBreakdowns` parameters that are never used — dead code with suppressed linting

**File:** `src/components/recommend/recommendation-result.tsx:27-41`

**Issue:**

```tsx
function getConflictsForFirm(
  firmId: string,
  teamFirmIds: string[],
  firmBreakdowns: FirmScoreBreakdown[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _excludedPairs: ExcludedPair[],
): ConflictRef[] {
  return [];
}
```

The function unconditionally returns `[]` regardless of all its parameters. `teamFirmIds` and `firmBreakdowns` are accepted but ignored (no `_` prefix, no eslint-disable comment). The eslint suppression only covers `_excludedPairs`. The function is called at line 126 with three non-trivial arguments that are computed for no effect. This is dead code masquerading as live logic — it will mislead future maintainers into believing conflict detection is implemented.

**Fix:** Remove the function and all call sites, and pass `conflictWith={[]}` directly at the `FirmSubCard` call sites, or implement the conflict detection properly using the `conflicts` data from the route response (which would require surfacing excluded pairs in the API response schema).

---

## Info

### IN-01: `PLACEHOLDER_ITEMS` in `app-navbar.tsx` is always an empty array — dead declaration

**File:** `src/components/app-navbar.tsx:38`

**Issue:**

```ts
const PLACEHOLDER_ITEMS: NavItem[] = [];
```

The array is iterated at line 83 but is always empty, so the loop body never executes. This is leftover scaffolding.

**Fix:** Remove the `PLACEHOLDER_ITEMS` declaration and its `.map()` render block.

---

### IN-02: `score-breakdown.tsx` declares `ExcludedPair` locally; it is also declared identically in `recommendation-result.tsx` — duplicated type

**File:** `src/components/recommend/score-breakdown.tsx:7-11` and `src/components/recommend/recommendation-result.tsx:43-47`

**Issue:** Both files define the same `ExcludedPair` type locally. Since `ScoreBreakdown` is only used inside `RecommendationResult`, the type should be defined once in a shared location (e.g. the schemas file or a shared types module) and imported.

**Fix:** Export `ExcludedPair` from `score-breakdown.tsx` (or a shared types file) and import it in `recommendation-result.tsx`.

---

### IN-03: E9 seeded integration test uses top-level `await` for dynamic imports — requires `"module": "esnext"` or `"type": "module"` in tsconfig/vitest config; if not set this silently becomes a runtime error in some environments

**File:** `src/lib/recommend/__tests__/seeded-e2e.test.ts:45`

**Issue:**

```ts
const clientModule = await import("@/db/client");
```

This top-level `await` in a `.ts` test file requires the module system to be configured for ESM. Vitest supports this, but the behaviour is environment-dependent. If the project ever adds a CommonJS build step or a test runner that doesn't handle top-level await, this file will fail at parse time with a cryptic error rather than a test failure. The `DB_AVAILABLE` guard means the failing path produces no visible test errors in most CI runs, making the misconfiguration easy to miss.

**Fix:** Move the dynamic imports inside the `it()` body or use `beforeAll`:

```ts
beforeAll(async () => {
  if (!DB_AVAILABLE) return;
  const clientModule = await import("@/db/client");
  // ... assign module variables
});
```

---

_Reviewed: 2026-06-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
