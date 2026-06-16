---
phase: 05-consortium-recommender-initial-report
plan: "01"
subsystem: recommend
tags:
  - scorer
  - zod
  - api
  - vitest
  - consortium
dependency_graph:
  requires:
    - 04-02 (conflictPairs, partnershipPairs, ownershipRecords, riskFlags tables)
    - 04-01 (procurementRecords table)
    - 01-01 (firms table, DB client)
  provides:
    - POST /api/recommend route
    - scoreAndRankCombinations pure function
    - RecommendResponseSchema (consumed by Plan 05-02 UI)
    - E1-E8 eval suite
  affects:
    - 05-02 (UI will import RecommendResponseSchema and call /api/recommend)
    - 05-03 (report page will call scoreAndRankCombinations directly)
tech_stack:
  added: []
  patterns:
    - Zod 4 discriminated union for typed API response
    - Pure-function scorer (no DB access, fully unit-testable)
    - Conflict exclusion Set for O(1) pair lookup
    - TDD — RED test first, then GREEN implementation
key_files:
  created:
    - src/lib/recommend/schemas.ts
    - src/lib/recommend/combinations.ts
    - src/lib/recommend/scorer.ts
    - src/app/api/recommend/route.ts
    - src/lib/recommend/__tests__/schemas.test.ts
    - src/lib/recommend/__tests__/scorer.test.ts
  modified:
    - PENDING_RELEASE.md
    - RELEASE_NOTES.md
decisions:
  - "Zod 4 uuid() enforces RFC 4122 format — test fixture UUIDs must use version 4 (4xxx) and variant bits (8xxx); non-compliant fixtures like aaaaaaaa-0000-0000-0000-000000000001 silently fail validation"
  - "ScorerResult interface uses reason?: string (optional) rather than a discriminated union — tests must use optional chaining (result.reason ?? '') to avoid TS18048 when accessing reason after status check"
  - "scorer.ts uses Object.freeze() on FirmScoreBreakdown and signalScores to enforce the immutable-score-objects best practice from AI-SPEC §4b.4 (Zod parse still works on frozen objects)"
metrics:
  duration: "~7 minutes"
  completed: "2026-06-16"
  tasks_completed: 3
  files_changed: 8
  tests_added: 38
---

# Phase 05 Plan 01: Scoring Engine Vertical Slice Summary

**One-liner:** Deterministic consortium scorer with Zod 4 schemas, combinations helper, pure-function weighted-sum + conflict-exclusion engine, and 38-test E1-E8 eval suite behind /api/recommend.

## What Was Built

### Task 1: Zod schemas + combinations helper

**schemas.ts** defines the complete API type contract with no Next.js imports:
- `CapabilityMixSchema` — Consultancy/Infrastructure/Nuclear counts 0-5 with `.refine` blocking all-zero mix
- `ScoringWeightsSchema` — four weights 0-100
- `RecommendRequestSchema` — with defaults for `lockedFirmIds: []` and `weights: 25/25/25/25`
- `FirmScoreBreakdownSchema` — firmId (UUID), firmName, signalScores (4 signals), weightedTotal, ownershipRecord (nullable), riskFlagCount, capabilityTags
- `TeamRecommendationSchema` — rank 1-3, score, firms array, hasPriorPartnerships
- `RecommendResponseSchema` — discriminated union: `ok` branch (recommendations min 1 max 3) vs `no_valid_team` branch (reason string, empty recommendations)

**combinations.ts** provides `combinations<T>(arr, k)` recursive head/tail helper. C(12,3)=220 is safe to enumerate synchronously.

**schemas.test.ts** — 14 tests: valid parse with defaults, 5 invalid rejection cases, ok/no_valid_team response branches, combinations boundary cases.

### Task 2: Pure scorer + E1-E8 eval suite

**scorer.ts** implements the complete deterministic algorithm as a pure module:
- `scoreContractRelevance(firmId, procurement, asOf)` — fraction of records with awardDate in last 5 years
- `scoreCapabilityMatch(firm, requestedTags)` — matched/requested fraction; `JSON.parse(capabilityTags ?? "[]")`
- `scoreUkOwnership(firmId, ownership)` — 1.0 yes / 0.5 unknown/missing / 0.0 no
- `scoreRiskFlags(firmId, riskFlags)` — 1.0 - burden/maxBurden (High=3, Medium=2, Low=1)
- `teamHasPriorPartnerships(teamIds, partnerships)` — true if any canonical pair in partnershipPairs
- `buildConflictSet(conflicts)` — builds Set of `"${minId}__${maxId}"` keys once, O(n)
- `hasConflict(firmIds, conflictSet)` — O(1) Set lookup per pair; never array.find() in loop
- `scoreAndRankCombinations(input: ScorerInput): ScorerResult` — main function: normalise weights, build conflict set, expand capabilityMix to requiredSlots, split locked/unlocked, generate combinations, hard-exclude conflicted/uncovering teams, score each firm, sort descending by team score with alphabetical tie-break, return top 3

Key invariants enforced:
- `ownershipRecord` ALWAYS populated in `FirmScoreBreakdown` regardless of `weights.ukOwnership` value (CONS-04 NSI non-suppression)
- `status: "no_valid_team"` with non-empty `reason` when no combination passes exclusion + coverage (never silent empty array — Pitfall 4)
- Conflict Set built once before combination loop (O(1) per pair, never O(n×combos))

**scorer.test.ts** — 24 tests covering:
- E1 conflict-exclusion: Set detection, order-independence, end-to-end exclusion
- E2 NSI: ownershipRecord populated even with ukOwnership weight 0; null when no record
- E3 scoring: 3-of-5 recent = 0.6, 1 High flag = 0.0, UK/foreign/unknown ownership, capability match
- E5 determinism: 100 identical runs deep-equal; alphabetical tie-break
- E6 explainability: all 7 breakdown fields present per firm
- E7 coverage: team covers all requested tags; uncoverable mix → no_valid_team
- E8 no-valid-team: all-conflicted fixture → status, empty array, non-empty reason
- CONS-05 locked: lockedFirmIds always in result; slotsToFill = teamSize - locked

### Task 3: /api/recommend route handler + release docs

**route.ts** follows the research/run/route.ts analog exactly:
- `import "server-only"` as first line
- JSON parse catch → 400
- `RecommendRequestSchema.safeParse` → 400 with `flatten()` details on failure
- Single `Promise.all` loading all 6 tables (read-only, never mutates Phase 1-4 tables)
- `scoreAndRankCombinations` call
- `RecommendResponseSchema.parse` (throws on contract violation — this is a bug, not user error)
- Structured `console.log` with `event: "recommend.request"` per AI-SPEC §7
- try/catch → 500 with `console.error` `event: "recommend.error"`
- No `db.insert`, `db.update`, `db.delete` anywhere

**PENDING_RELEASE.md** and **RELEASE_NOTES.md** updated.

## Verification Results

```
npx vitest run src/lib/recommend/
  Test Files  2 passed (2)
  Tests  38 passed (38)

npx tsc --noEmit (recommend module)
  no recommend type errors

npm test
  Test Files  20 passed (20)
  Tests  197 passed (197)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod 4 UUID strict RFC 4122 validation**
- **Found during:** Task 1 GREEN phase — schemas test failing
- **Issue:** Zod 4 enforces the full RFC 4122 UUID pattern including version bits `[1-8]` and variant bits `[89ab]`. The test fixture UUID `"aaaaaaaa-0000-0000-0000-000000000001"` used in the plan's behavior section fails this check (version byte `0` is invalid).
- **Fix:** Updated all test fixture UUIDs to RFC 4122 compliant format (e.g. `"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"` with version 4 and variant `8`). Same fix applied consistently across scorer.test.ts fixtures.
- **Files modified:** `src/lib/recommend/__tests__/schemas.test.ts`, `src/lib/recommend/__tests__/scorer.test.ts`
- **Commit:** c4df6d3 (initial), 1109ba8 (scorer)

**2. [Rule 1 - Bug] ScorerResult.reason TypeScript narrowing (TS18048)**
- **Found during:** Task 3 TypeScript compilation check
- **Issue:** `ScorerResult` declares `reason?: string` (optional), and TypeScript does not narrow it to `string` inside `if (result.status === "no_valid_team")` because `ScorerResult` is not a proper discriminated union (it uses a plain interface, not a Zod-inferred union type). TypeScript emits TS18048: `'result.reason' is possibly 'undefined'`.
- **Fix:** Changed `result.reason.length` to `(result.reason ?? "").length` in scorer.test.ts E8 test.
- **Files modified:** `src/lib/recommend/__tests__/scorer.test.ts`
- **Commit:** cbd146e

## Known Stubs

None — no placeholder data, no hardcoded empty values flowing to UI, no TODO comments. The scorer is fully functional for its inputs; the route handler is fully wired.

## Threat Flags

All STRIDE threats in the plan threat model are mitigated by the implementation:
- T-05-01: `z.number().int().min(0).max(5)` per capability
- T-05-02: `z.number().min(0).max(100)` per weight; normalised server-side
- T-05-03: `z.array(z.string().uuid())` on lockedFirmIds
- T-05-04: `.refine((mix) => Object.values(mix).some(v => v > 0))`
- T-05-05: `RecommendResponseSchema.parse()` blocks malformed scorer output
- T-05-06: no `db.insert`, `db.update`, `db.delete` in route.ts or scorer.ts

No new threat surface introduced beyond what the plan documented.

## Self-Check: PASSED

Files exist:
- src/lib/recommend/schemas.ts: FOUND
- src/lib/recommend/combinations.ts: FOUND
- src/lib/recommend/scorer.ts: FOUND
- src/app/api/recommend/route.ts: FOUND
- src/lib/recommend/__tests__/schemas.test.ts: FOUND
- src/lib/recommend/__tests__/scorer.test.ts: FOUND

Commits exist:
- c4df6d3 feat(05-01): Zod schemas + combinations helper: FOUND
- 1109ba8 feat(05-01): pure scorer + E1-E8 eval suite: FOUND
- cbd146e feat(05-01): /api/recommend POST route + release docs: FOUND
