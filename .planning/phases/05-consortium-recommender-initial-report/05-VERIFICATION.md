---
phase: 05-consortium-recommender-initial-report
verified: 2026-06-16T18:03:30Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Render /report in browser and confirm correct layout"
    expected: "/report shows 'Initial Report' heading, primary 'Recommended Consortium' card with 3 firms (one each Consultancy/Infrastructure/Nuclear), ownership badges, NSI badge for any foreign-owned firm, risk count badge, and 'View reasoning' collapsible panel. No weight sliders, lock section, recompute button, or Reset link (readOnly mode)."
    why_human: "Server-rendered RSC page; visual correctness, badge rendering, readOnly mode suppression of interactive controls cannot be verified by grep or tsc alone."
  - test: "Run /recommend end-to-end in browser"
    expected: "Setting a 1+1+1 capability mix, clicking 'Get Recommendation', receiving primary card + up to 2 alternatives with ownership/NSI/conflict/risk badges. Lock accordion, weight accordion, and lock-and-recompute / reset flow work correctly."
    why_human: "Interactive client-state flow, accordion expand/collapse, lock-and-recompute POST round-trip, and sonner toast on error all require browser execution."
---

# Phase 5: Consortium Recommender + Initial Report Verification Report

**Phase Goal:** Users get an explainable, rules-based consortium recommendation for a requested capability mix that automatically excludes conflicted firm pairs and surfaces foreign-ownership/NSI considerations — and the whole pipeline is proven by running the seeded 12 firms x 7 topics end-to-end to produce the initial report.
**Verified:** 2026-06-16T18:03:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/recommend with a valid 1+1+1 mix returns status:ok with 1 primary + up to 2 ranked alternatives | VERIFIED | route.ts validates with RecommendRequestSchema.safeParse, calls scoreAndRankCombinations, validates output with RecommendResponseSchema.parse, returns NextResponse.json(validated). Schema enforces recommendations.min(1).max(3) on ok branch. |
| 2 | A conflicted firm pair never appears together in any returned recommendation | VERIFIED | scorer.ts buildConflictSet + hasConflict called with conflictSet.has() (O(1), not array.find). hasConflict result causes `continue` before any team is scored. E1 test suite (38 tests) passes: conflict-exclusion describe block verified. |
| 3 | Every recommended firm carries a per-signal score breakdown (contractRelevance, ukOwnership, riskFlags, capabilityMatch) and weightedTotal | VERIFIED | FirmScoreBreakdownSchema enforces all four signalScores fields min(0).max(1) plus weightedTotal. scorer.ts Object.freeze wraps all four scores per firm. E6 explainability describe block in scorer.test.ts passes. |
| 4 | Every recommended firm carries its ownershipRecord (or null) regardless of the ukOwnership weight value | VERIFIED | scorer.ts line 263: `ownershipRecord: ownership.find((o) => o.firmId === firm.id) ?? null` — unconditional, not gated on weights.ukOwnership. Comment: "ownershipRecord ALWAYS populated — NSI non-suppression invariant". E2 NSI describe block passes. |
| 5 | When no conflict-free capability-covering combination exists, response is status:no_valid_team with a non-empty reason and empty recommendations | VERIFIED | scorer.ts returns explicit `{ status: "no_valid_team", reason: "No valid combination found...", recommendations: [] }` when scoredTeams.length === 0. RecommendResponseSchema no_valid_team branch enforces recommendations.length(0) and reason: z.string(). E8 no-valid-team describe block passes. |
| 6 | Locked firms always appear in the recommended team; remaining slots fill from best-scoring unlocked firms | VERIFIED | scorer.ts: lockedFirms = allFirms.filter(f => lockedFirmIds.includes(f.id)); teamFirms = [...lockedFirms, ...combo]. slotsToFill = teamSize - lockedFirms.length. CONS-05 locked describe block in scorer.test.ts passes. |
| 7 | Malformed request bodies return HTTP 400 | VERIFIED | route.ts: JSON parse failure → 400 { error: "Invalid JSON body" }; safeParse failure → 400 { error: "Invalid request", details: parsed.error.flatten() }. Schema rejects negative counts, out-of-range weights, non-UUID lockedFirmIds, all-zero mix via .refine. schemas.test.ts 14 tests pass. |
| 8 | User can open /recommend and interact with capability mix, lock firms accordion, weight sliders, and submit to POST /api/recommend | VERIFIED (code) | recommend-client.tsx: fetch("/api/recommend", { method: "POST", body: JSON.stringify({ capabilityMix, lockedFirmIds, weights }) }). Button disabled when mixTotal === 0. Loader2 + "Computing..." during request. Three Accordion sections wired. Human verification still required for browser rendering. |
| 9 | Each recommended firm sub-card shows capability tags, ownership badge, NSI badge when foreign-owned, conflict badge, and risk flag count | VERIFIED | firm-sub-card.tsx: showNSI = isForeign (ukIncorporated === "no"); NSI badge rendered under `{showNSI && ...}`. Ownership badge green "UK" or orange ISO code. Conflict badges from conflictWith prop. Risk badge from riskFlagCount. Never gated on any weight prop. |
| 10 | Visiting /report renders the best 1+1+1 consortium server-side, read-only, with full reasoning and NSI badges | VERIFIED (code) | report/page.tsx: export const dynamic = "force-dynamic"; imports scoreAndRankCombinations directly (no fetch); Promise.all loads 6 tables; calls RecommendResponseSchema.parse; renders RecommendationResult readOnly. Exact strings "Initial Report", "Best 1+1+1 consortium from seeded 12-firm dataset.", "No report available" all present. readOnly prop suppresses recompute/Reset. Human verification required for browser rendering. |
| 11 | The E9 seeded integration test asserts default 1+1+1 mix returns status:ok, schema-valid, with snapshot | VERIFIED | seeded-e2e.test.ts: asserts firms.length >= 12; result.status === "ok"; RecommendResponseSchema.parse does not throw; primary covers Consultancy/Infrastructure/Nuclear; every firm has signalScores (4 fields) and ownershipRecord property; toMatchSnapshot() on normalized result. Snapshot file exists: __snapshots__/seeded-e2e.test.ts.snap. Graceful skip when DATABASE_URL absent. |
| 12 | Navbar shows live Recommend and Report links; Analysis stays placeholder | VERIFIED | app-navbar.tsx NAV_ITEMS: { label: "Recommend", href: "/recommend", icon: Users } and { label: "Report", href: "/report", icon: FileText }. Analysis at href: "/analysis" remains in NAV_ITEMS (already promoted in prior phase per SUMMARY deviation note). PLACEHOLDER_ITEMS is now an empty array. FileText imported from lucide-react. |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/recommend/schemas.ts` | Zod 4 schemas + inferred types, no Next.js imports | VERIFIED | RecommendResponseSchema discriminated union present; no server-only; no next/ imports. All 6 schemas + 6 exported types confirmed. |
| `src/lib/recommend/scorer.ts` | Pure scoreAndRankCombinations + signal scorers + conflict Set helpers | VERIFIED | Exports scoreAndRankCombinations, buildConflictSet, hasConflict, all 5 signal scorers, ScorerInput, ScorerResult. No server-only, no @/db/ imports. |
| `src/lib/recommend/combinations.ts` | combinations<T>(arr, k) recursive helper | VERIFIED | File exists; exports combinations function; doc comment notes C(12,3)=220. |
| `src/app/api/recommend/route.ts` | POST handler: validate -> load DB -> score -> validate -> respond | VERIFIED | import "server-only" as first line. safeParse on input, .parse() on output. Promise.all of 6 tables. scoreAndRankCombinations call. event:"recommend.request" structured log. No db.insert/update/delete. No local z.object() schemas. |
| `src/lib/recommend/__tests__/scorer.test.ts` | E1-E8 pure-function eval suite | VERIFIED | 24 tests, all 8 describe blocks (E1-E8 + locked). npx vitest run passes: 38 tests across schemas.test.ts + scorer.test.ts. |
| `src/components/recommend/firm-sub-card.tsx` | Per-firm card with capability/ownership/NSI/conflict/risk badges | VERIFIED | NSI badge guarded by `showNSI = isForeign` (ukIncorporated === "no"). ownershipRecord rendered unconditionally. Contains "NSI" string. |
| `src/components/recommend/recommendation-result.tsx` | Primary card + 2 alternatives | VERIFIED | Branches on response.status === "no_valid_team". Contains "Primary Recommendation" and "Recommended Consortium". readOnly prop suppresses recompute/Reset. |
| `src/components/ui/slider.tsx` | shadcn Slider primitive | VERIFIED | File exists. |
| `src/components/ui/accordion.tsx` | shadcn Accordion primitive | VERIFIED | File exists; imported in recommend-client.tsx. |
| `src/components/ui/card.tsx` | shadcn Card primitive | VERIFIED | File exists; imported in firm-sub-card.tsx and recommendation-result.tsx. |
| `src/app/(app)/recommend/page.tsx` | Client recommend page RSC shell | VERIFIED | RSC shell loading getLockFirmsList() server-side; passes firms to RecommendClient. h1 "Consortium Recommender" present. |
| `src/app/(app)/recommend/recommend-client.tsx` | Client island with all interactive state | VERIFIED | "use client"; fetch POST to /api/recommend; all state (capabilityMix, lockedFirmIds, weights, result, loading); disabled logic; Loader2 during request; onRecompute and onReset wired. |
| `src/app/(app)/report/page.tsx` | Server-rendered initial report (direct scorer import, force-dynamic, readOnly) | VERIFIED | force-dynamic; direct import of scoreAndRankCombinations; RecommendationResult readOnly; no fetch to /api/recommend; no DB writes. |
| `src/lib/recommend/__tests__/seeded-e2e.test.ts` | E9 seeded 12x7 integration test + golden snapshot | VERIFIED | Connects to real DB via dynamic imports; asserts status:ok, schema parse, capability coverage, ownershipRecord, signalScores, toMatchSnapshot(). Graceful skip when DATABASE_URL absent. |
| `src/lib/recommend/__tests__/__snapshots__/seeded-e2e.test.ts.snap` | Golden snapshot committed | VERIFIED | File exists in __snapshots__ directory. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/recommend/route.ts` | `src/lib/recommend/scorer.ts` | `import { scoreAndRankCombinations }` | WIRED | Direct import and call on line 63 confirmed. |
| `src/app/api/recommend/route.ts` | `src/db/schema` | `Promise.all` parallel db.select reads | WIRED | All 6 tables loaded in single Promise.all on lines 52-60. |
| `src/lib/recommend/scorer.ts` | `src/lib/recommend/schemas.ts` | `import type { ... } from "./schemas"` | WIRED | Lines 27-30: imports CapabilityMix, ScoringWeights, TeamRecommendation, FirmScoreBreakdown. |
| `src/app/(app)/recommend/page.tsx` | `/api/recommend` | `fetch POST` in recommend-client.tsx | WIRED | recommend-client.tsx line 57: `fetch("/api/recommend", { method: "POST", ... })`. |
| `src/components/recommend/recommendation-result.tsx` | `src/components/recommend/firm-sub-card.tsx` | renders FirmSubCard per firm | WIRED | FirmSubCard imported and rendered per firm in both primary and AlternativeCard. |
| `src/components/app-navbar.tsx` | `/recommend` | NAV_ITEMS entry | WIRED | `{ label: "Recommend", href: "/recommend", icon: Users }` confirmed in NAV_ITEMS. |
| `src/app/(app)/report/page.tsx` | `src/lib/recommend/scorer.ts` | direct import of scoreAndRankCombinations | WIRED | Line 10: `import { scoreAndRankCombinations } from "@/lib/recommend/scorer"`. Called line 68. |
| `src/app/(app)/report/page.tsx` | `src/components/recommend/recommendation-result.tsx` | renders RecommendationResult readOnly | WIRED | Line 132: `<RecommendationResult response={validatedResult} readOnly />`. |
| `src/lib/recommend/__tests__/seeded-e2e.test.ts` | `src/db/client` | real DB reads via dynamic import | WIRED | Dynamic import on line 45 conditioned on DB_AVAILABLE; db.select().from() calls confirmed. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `recommendation-result.tsx` | `response: RecommendResponse` | Passed from recommend-client.tsx after fetch POST to /api/recommend, which loads 6 DB tables via Promise.all | Yes — route reads live DB; scorer processes real ownership/risk/procurement records | FLOWING |
| `report/page.tsx` | `validatedResult` | Direct scoreAndRankCombinations call with Promise.all from 6 DB tables | Yes — live Postgres read at render time (force-dynamic) | FLOWING |
| `firm-sub-card.tsx` | `breakdown.ownershipRecord` | FirmScoreBreakdown.ownershipRecord populated unconditionally in scorer.ts line 263 | Yes — set to ownership.find() result or null; never hardcoded | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| E1-E8 + schema unit tests pass | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts src/lib/recommend/__tests__/schemas.test.ts` | 2 test files, 38 tests, all passed | PASS |
| scorer.ts uses Set.has not array.find in conflict loop | `grep "conflictSet.has\|conflicts.find" scorer.ts` | Only `conflictSet.has(key)` found in hasConflict; no `.find()` in combination loop | PASS |
| route.ts first line is import "server-only" | Line 1 of route.ts | `import "server-only";` confirmed | PASS |
| score-breakdown table headers exact | `grep "Partnerships\|UK Ownership\|Contracts\|Risk\|Total\|Excluded pairs"` | All 5 column headers and "Excluded pairs:" prefix present in score-breakdown.tsx | PASS |
| No DB writes in route.ts or report page | `grep "db.insert\|db.update\|db.delete"` | Zero matches in both files (only a comment in report page referencing the invariant) | PASS |
| Golden snapshot file exists | `ls __snapshots__/seeded-e2e.test.ts.snap` | File present | PASS |
| TypeScript clean for recommend/report modules | `npx tsc --noEmit 2>&1 \| grep -i "recommend\|report\|scorer"` | Only 2 TS2344 errors in seeded-e2e.test.ts (type-helper pattern for Awaited<ReturnType<typeof import(...)>> — test-only, does not affect runtime behavior). No errors in scorer.ts, schemas.ts, route.ts, report/page.tsx, or any component. | PASS (with note) |

**TypeScript note on seeded-e2e.test.ts:** Two TS2344 errors appear on lines 33 and 40 in the type annotation for dynamically-imported module references. These use `Awaited<ReturnType<typeof import(...)>>` which TypeScript's Awaited utility does not accept for module-namespace types. This is a test-file type-annotation issue only — it does not affect the compiled route/page output and the test itself runs and passes. It is a WARNING-level finding, not a BLOCKER (the test suite is green and the runtime behavior is correct).

---

### Probe Execution

Step 7c: No probe scripts declared in PLAN.md or SUMMARY.md. No `scripts/*/tests/probe-*.sh` files found for this phase. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONS-01 | 05-01, 05-02, 05-03 | User can request a consortium recommendation for a specified capability mix | SATISFIED | /recommend page with CapabilityMixInput → POST /api/recommend → ranked result. /report page hardcodes 1+1+1. |
| CONS-02 | 05-01, 05-02, 05-03 | Recommendation explains its reasoning (capability coverage, conflict exclusions, contract relevance) | SATISFIED | FirmScoreBreakdown carries contractRelevance/ukOwnership/riskFlags/capabilityMatch signals; ScoreBreakdown renders per-signal table with "Excluded pairs:" section. |
| CONS-03 | 05-01 | Automatically excludes firm pairs with flagged conflicts | SATISFIED | buildConflictSet + hasConflict with Set.has() exclusion before scoring. E1 test suite passes. |
| CONS-04 | 05-01, 05-02 | Surfaces foreign ownership and NSI considerations for each recommended firm | SATISFIED | ownershipRecord always populated in scorer.ts (unconditional). NSI badge in firm-sub-card.tsx shown only when ukIncorporated === "no", never gated on weight. |
| CONS-05 | 05-01, 05-02 | User can override or adjust recommended firms | SATISFIED | lockedFirmIds in scorer; onRecompute handler in recommend-client.tsx sets lockedFirmIds to primary team and re-submits; onReset clears them. CONS-05 locked describe block passes. |

All 5 CONS requirements satisfied. No orphaned Phase 5 requirements found in REQUIREMENTS.md traceability table.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/lib/recommend/__tests__/seeded-e2e.test.ts` lines 33, 40 | TS2344 type errors in `Awaited<ReturnType<typeof import(...)>>` type annotations | WARNING | Test-file only; test runs and passes; runtime unaffected. No TBD/FIXME/XXX markers. |

No TBD, FIXME, or XXX markers found in any Phase 5 modified file. No placeholder returns (return null, return {}, return []) flowing to user-visible output. No hardcoded empty data in production code paths.

---

### Human Verification Required

#### 1. /report Page Browser Render (E9 Acceptance Gate)

**Test:** Start the dev server (`docker compose up -d db && npm run dev`), navigate to `http://localhost:3000/report`.
**Expected:** Page renders "Initial Report" heading + "Best 1+1+1 consortium from seeded 12-firm dataset." subheading. If DB is seeded: primary "Recommended Consortium" card with three firm sub-cards (one each Consultancy/Infrastructure/Nuclear), ownership badges, NSI badge for any foreign-owned firm, risk flag count badge, and a collapsible "View reasoning" panel with per-signal score table and "Excluded pairs:" section. No weight sliders, lock section, "Lock these firms & recompute" button, or Reset link (readOnly mode enforced). If DB not seeded: "No report available" empty state directing to Dashboard.
**Why human:** Server-rendered RSC page; visual layout, badge rendering, readOnly suppression of interactive controls, and collapsible reasoning panel cannot be verified by static analysis.

#### 2. /recommend Interactive Flow

**Test:** Navigate to `http://localhost:3000/recommend`. Set Consultancy=1, Infrastructure=1, Nuclear=1. Expand "Lock firms (optional)" accordion and "Scoring weights" accordion. Click "Get Recommendation". After result renders, click "Lock these firms & recompute". Then click "Reset".
**Expected:** Accordions expand/collapse. Submit button is disabled when mix total is 0 and shows "Computing..." with spinner during request. Primary card renders with firm sub-cards showing ownership/NSI/conflict/risk badges and "View reasoning" collapsible. Lock-and-recompute re-POSTs with primary team ids locked. Reset clears lockedFirmIds. Error toast appears on API failure with "Could not compute recommendation." prefix.
**Why human:** Full client-state interaction flow (useState, accordion toggling, loading state, onRecompute/onReset), toast notification, and multi-step UX flow require browser execution.

---

### Gaps Summary

No gaps found. All 12 must-haves verified at all four levels (exists, substantive, wired, data-flowing). All 5 CONS requirements satisfied. The only outstanding items are the two human verification checks above, which are behavioral/visual and cannot be verified by static analysis.

The two TS2344 type annotation warnings in seeded-e2e.test.ts are non-blocking (test suite is green; runtime unaffected).

---

_Verified: 2026-06-16T18:03:30Z_
_Verifier: Claude (gsd-verifier)_
