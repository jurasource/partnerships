---
phase: "05"
phase_name: "consortium-recommender-initial-report"
review_depth: standard
files_reviewed: 20
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
  - src/lib/recommend/__tests__/__snapshots__/seeded-e2e.test.ts.snap
status: issues-found
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
---

# Code Review — Phase 05: consortium-recommender-initial-report

## Summary

Twenty files were reviewed covering the full consortium recommender: pure-function scorer, Zod schemas, Next.js API route, React UI components, and the `/report` RSC page. The core scorer is well-structured and the test suite is thorough. Two correctness bugs are present in the scorer itself: one causes silent incorrect output when more firms are locked than team slots exist, and one means the partnership weight is structurally mis-normalised relative to the three per-firm signals, distorting rankings whenever weights are not equal. Five warning-level issues cover unsafe JSON parsing, a misleading UI column label, state inconsistency on reset, absent locked-firm ID validation, and a test that silently passes (skips) when the DB is absent. Four info items flag dead code and minor duplication.

## Findings

---

### CR-001 — Silent incorrect output when `lockedFirmIds` count exceeds `teamSize` (Critical)

**File:** `src/lib/recommend/scorer.ts:212-216`

**Issue:** When the caller supplies more locked firm IDs than slots in the requested capability mix, `slotsToFill = teamSize - lockedFirms.length` becomes negative (or zero when overconstrained). The branch at line 214 treats `slotsToFill <= 0` as "all slots filled by locked firms" and proceeds with `[[]]` as the only candidate combination — a team composed solely of the locked firms, regardless of how many there are or whether they cover the requested capabilities. There is no guard that rejects the case `lockedFirms.length > teamSize`.

**Impact:** A user who locks 4 firms against a 3-slot mix receives a recommendation that is a 4-firm team scored as if it were valid. The response passes Zod validation because `TeamRecommendationSchema` does not constrain `firms.length`. Users receive confidently-wrong output with no error message.

**Fix:**
```typescript
// After computing teamSize and lockedFirms, before building candidateCombinations:
if (lockedFirms.length > teamSize) {
  return {
    status: "no_valid_team",
    reason: `${lockedFirms.length} firms are locked but the requested capability mix only requires ${teamSize} slots.`,
    recommendations: [],
  };
}
```

---

### CR-002 — Partnership weight is included in the normalisation denominator but applied as an additive team-level bonus — distorts rankings at unequal weights (Critical)

**File:** `src/lib/recommend/scorer.ts:187-195, 246-275`

**Issue:** `weights.partnerships` is included in `wTotal` (line 188) and normalised into `w.partnerships` (line 193) alongside the three per-firm signal weights. However `w.partnerships` is never applied inside the per-firm score loop — only `w.contractRelevance`, `w.ukOwnership`, and `w.riskFlags` are used there (capability is intentionally zeroed at line 250). Instead, `w.partnerships` is applied as an additive team-level bonus (lines 272–274):

```typescript
const partnershipBonus = teamHasPriorPartnerships(teamIds, partnerships)
  ? w.partnerships
  : 0;
const teamScore = meanFirmScore + partnershipBonus;
```

Because `wTotal` includes the partnership weight, the three per-firm signals are normalised against an inflated denominator. At equal weights (25/25/25/25): `w.contractRelevance = w.ukOwnership = w.riskFlags = 0.25`, so the maximum possible `meanFirmScore` is `0.75`. A team with prior partnerships scores `0.75 + 0.25 = 1.0` — this works correctly by accident. But at skewed weights (e.g. partnerships=50, others=10/10/10): per-firm signals normalise to `30/80 = 0.375` maximum, while the partnership bonus is `50/80 = 0.625`. The partnership signal then outweighs the three substantive signals combined, in a way that users cannot predict from the UI label "weights are normalised automatically."

**Impact:** Firm rankings are incorrect whenever weight sliders deviate from equal values. The scoring engine violates its stated invariant that all four weights contribute proportionally.

**Fix:** Exclude `partnerships` from the per-firm normalisation pool and apply it as a separate fractional bonus:

```typescript
// Normalise only the three per-firm signals to sum to 1.0
const perFirmRaw = weights.contractRelevance + weights.ukOwnership + weights.riskFlags;
const perFirmTotal = perFirmRaw === 0 ? 3 : perFirmRaw;
const w = {
  contractRelevance: weights.contractRelevance / perFirmTotal,
  ukOwnership:       weights.ukOwnership       / perFirmTotal,
  riskFlags:         weights.riskFlags          / perFirmTotal,
  // Partnership bonus scaled independently: 0 when weight=0, up to (partnerships / (partnerships + perFirmRaw)) when max
  partnerships: weights.partnerships / (weights.partnerships + perFirmTotal),
};
```

---

### WR-001 — Three unguarded `JSON.parse` calls on the `capabilityTags` text column can throw and crash the scorer (Warning)

**File:** `src/lib/recommend/scorer.ts:64, 233, 265`

**Issue:** `firm.capabilityTags` is a `text` column. The code guards the null case with `?? "[]"`, but `JSON.parse` throws a `SyntaxError` if the stored value is non-null but malformed (e.g. a bare string `Nuclear` rather than `["Nuclear"]`). This also applies in `src/lib/queries/lock-firms.ts:35`.

**Impact:** A single row with a corrupted `capabilityTags` value crashes the scorer mid-loop, which bubbles up as a 500 from the API route. On the `/report` RSC page the same issue causes an unhandled render error (see WR-004).

**Fix:** Replace all bare `JSON.parse` call sites with a safe helper:

```typescript
function parseCapabilityTags(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}
```

Apply in `scorer.ts` lines 64, 233, 265 and in `lock-firms.ts` line 35.

---

### WR-002 — `ScoreBreakdown` table "Partnerships" column header renders `capabilityMatch` data — factually wrong display (Warning)

**File:** `src/components/recommend/score-breakdown.tsx:39, 51`

**Issue:** The column header at line 39 reads `"Partnerships"`, but the cell at line 51 renders `firm.signalScores.capabilityMatch`. `FirmScoreBreakdown` has no per-firm `partnerships` field — partnerships is a team-level boolean, not a per-firm signal score. The column header and the data it shows do not match.

**Impact:** Users reading the reasoning table see capability-match percentages labelled as "Partnerships". This is factually wrong and directly undermines the per-signal explainability guarantee (CONS-02).

**Fix:**
```tsx
// Rename the column header to match the actual data:
<th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Capability</th>
```
Alternatively, remove the column and surface `team.hasPriorPartnerships` as a team-level label below the table.

---

### WR-003 — `handleReset` clears `lockedFirmIds` but does not clear `result` — stale recommendation stays visible after reset (Warning)

**File:** `src/app/(app)/recommend/recommend-client.tsx:94-96`

**Issue:**

```typescript
function handleReset() {
  setLockedFirmIds([]);
  // result is not cleared
}
```

After the user clicks "Reset", the previous recommendation remains on screen even though the lock state has changed. The displayed result is now inconsistent with the displayed form state.

**Fix:**
```typescript
function handleReset() {
  setLockedFirmIds([]);
  setResult(null);
}
```

---

### WR-004 — `lockedFirmIds` UUIDs are not validated against DB rows — stale or non-existent IDs silently drop the lock constraint (Warning)

**File:** `src/app/api/recommend/route.ts:48-65`

**Issue:** The Zod schema validates that each element of `lockedFirmIds` is a UUID, but never checks that the UUID corresponds to a row in `allFirms`. Inside the scorer, `lockedFirms = allFirms.filter((f) => lockedFirmIds.includes(f.id))` silently produces a shorter array when IDs do not match. The scorer proceeds with a reduced `lockedFirms.length`, violating CONS-05 without any 4xx error.

**Impact:** A client that sends a valid-format UUID for a deleted or non-existent firm receives a recommendation that silently omits that firm, with no indication that the locking constraint was dropped.

**Fix:** After loading `allFirms`, validate that all locked IDs resolve:

```typescript
const allFirmIdSet = new Set(allFirms.map((f) => f.id));
const missingIds = lockedFirmIds.filter((id) => !allFirmIdSet.has(id));
if (missingIds.length > 0) {
  return NextResponse.json(
    { error: "One or more locked firm IDs do not exist", missingIds },
    { status: 422 },
  );
}
```

---

### WR-005 — E9 integration test silently passes (not skipped) when `DATABASE_URL` is absent — masking CI regressions (Warning)

**File:** `src/lib/recommend/__tests__/seeded-e2e.test.ts:63-72`

**Issue:** The test body uses `return` (not `test.skip()`) to exit early when the DB is unavailable. In Vitest, a test that `return`s early counts as a **passing** test, not a skipped one. The test suite reports green in any CI environment without `DATABASE_URL`, without having executed a single assertion. The snapshot tripwire — the stated regression guard — provides no protection in that case.

**Fix:** Use Vitest's skip mechanism at the `describe` level so the test is visibly skipped (yellow) rather than falsely green:

```typescript
describe.skipIf(!DB_AVAILABLE)("E9 — seeded 12×7 integration test", () => {
  // test body runs only when DB_AVAILABLE is true
  it("returns a schema-valid 1+1+1 ok result from the seeded Postgres", async () => {
    // no early-return guard needed here
    ...
  });
});
```

---

### IN-001 — `getConflictsForFirm` always returns `[]` — dead function with suppressed lint warning (Info)

**File:** `src/components/recommend/recommendation-result.tsx:27-41`

**Issue:** The function body unconditionally returns `[]` regardless of all parameters. `teamFirmIds` and `firmBreakdowns` are accepted but never read. The `eslint-disable` comment covers only `_excludedPairs`. The function is called at line 126 with computed arguments that have no effect. It misleads future maintainers into believing intra-team conflict display is implemented.

**Fix:** Remove the function and all call sites; pass `conflictWith={[]}` directly at the `FirmSubCard` render sites, or implement the detection using the conflicts data if the feature is in scope.

---

### IN-002 — Duplicate local type declarations shadow the canonical Zod-inferred types (Info)

**File:** `src/components/recommend/capability-mix-input.tsx:6-10`, `src/components/recommend/weight-sliders.tsx:5-10`

**Issue:** Both components declare local `CapabilityMix` and `ScoringWeights` types structurally identical to the Zod-inferred types in `@/lib/recommend/schemas`. If a field is added to the schema, these local types must be updated separately and independently.

**Fix:**
```typescript
import type { CapabilityMix } from "@/lib/recommend/schemas";
// Remove the local type declaration
```

---

### IN-003 — `PLACEHOLDER_ITEMS` in `app-navbar.tsx` is always an empty array — dead declaration and dead render block (Info)

**File:** `src/components/app-navbar.tsx:38, 83-91`

**Issue:** `const PLACEHOLDER_ITEMS: NavItem[] = []` is declared and then iterated in JSX, producing no output. Both the constant and the `.map()` block are dead code.

**Fix:** Remove the `PLACEHOLDER_ITEMS` constant and its corresponding JSX render block.

---

### IN-004 — `teamHasPriorPartnerships` called twice per team — redundant computation (Info)

**File:** `src/lib/recommend/scorer.ts:272-274, 308-313`

**Issue:** For each scored team, `teamHasPriorPartnerships` is called once inside the scoring loop (line 272) to derive `partnershipBonus`, and again inside the final `.slice(0, 3).map(...)` (line 309) to populate the returned `TeamRecommendation`. Both calls receive identical arguments and produce the same result. The second call is wasted work and a latent inconsistency risk.

**Fix:** Store the boolean from the first call and reuse it in the accumulated team record:

```typescript
const hasPriorPartnerships = teamHasPriorPartnerships(teamIds, partnerships);
const partnershipBonus = hasPriorPartnerships ? w.partnerships : 0;
const teamScore = meanFirmScore + partnershipBonus;
scoredTeams.push({ team: teamFirms, score: teamScore, breakdown, hasPriorPartnerships });

// In the return map:
recommendations: scoredTeams.slice(0, 3).map((s, idx) => ({
  rank: idx + 1,
  score: s.score,
  firms: s.breakdown,
  hasPriorPartnerships: s.hasPriorPartnerships, // no second call
})),
```

---

## Files Reviewed

- `src/lib/recommend/schemas.ts`
- `src/lib/recommend/combinations.ts`
- `src/lib/recommend/scorer.ts`
- `src/app/api/recommend/route.ts`
- `src/lib/recommend/__tests__/schemas.test.ts`
- `src/lib/recommend/__tests__/scorer.test.ts`
- `src/components/recommend/capability-mix-input.tsx`
- `src/components/recommend/weight-sliders.tsx`
- `src/components/recommend/lock-firms-section.tsx`
- `src/components/recommend/firm-sub-card.tsx`
- `src/components/recommend/score-breakdown.tsx`
- `src/components/recommend/no-valid-team-state.tsx`
- `src/components/recommend/recommendation-result.tsx`
- `src/app/(app)/recommend/page.tsx`
- `src/app/(app)/recommend/recommend-client.tsx`
- `src/lib/queries/lock-firms.ts`
- `src/components/app-navbar.tsx`
- `src/app/(app)/report/page.tsx`
- `src/lib/recommend/__tests__/seeded-e2e.test.ts`
- `src/lib/recommend/__tests__/__snapshots__/seeded-e2e.test.ts.snap`

---

_Reviewed: 2026-06-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
