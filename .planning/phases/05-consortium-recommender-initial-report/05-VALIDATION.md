---
phase: 5
slug: consortium-recommender-initial-report
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (unit) / ~60 seconds (full with E9 integration) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/recommend/__tests__/scorer.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + E9 seeded run passes + `/report` renders without error
- **Max feedback latency:** ~15 seconds (unit suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CONS-01 | T-5-01 | Zod rejects malformed capabilityMix | unit | `npx vitest run src/lib/recommend/__tests__/schemas.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | CONS-01 | — | scoreAndRankCombinations returns ok+team for valid 1+1+1 | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "scoreAndRankCombinations"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | CONS-03 | T-5-02 | conflicted pairs never co-recommended | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "conflict-exclusion"` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | CONS-02 | — | per-signal breakdown present in every firm | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "explainability"` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | CONS-04 | — | ownershipRecord non-null regardless of weight | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "NSI"` | ❌ W0 | ⬜ pending |
| 05-01-06 | 01 | 1 | CONS-05 | — | locked firms always in result | unit | `npx vitest run src/lib/recommend/__tests__/scorer.test.ts -t "locked"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | CONS-01 | T-5-01 | POST /api/recommend returns 400 on bad input | manual | curl / Playwright | N/A | ⬜ pending |
| 05-02-02 | 02 | 2 | CONS-01–05 | — | /recommend page renders result after form submit | manual | browser test | N/A | ⬜ pending |
| 05-03-01 | 03 | 3 | CONS-01–05 | — | /report renders best 1+1+1 from seeded 12 firms | integration | `npx vitest run src/lib/recommend/__tests__/seeded-e2e.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/recommend/schemas.ts` — Zod 4 request/response schemas (no Next.js imports)
- [ ] `src/lib/recommend/scorer.ts` — pure scoring functions + `scoreAndRankCombinations()`
- [ ] `src/lib/recommend/combinations.ts` — `combinations<T>(arr, k): T[][]` helper
- [ ] `src/lib/recommend/__tests__/scorer.test.ts` — E1–E8 pure-function evals (stubs for CONS-01 through CONS-05)
- [ ] `src/lib/recommend/__tests__/schemas.test.ts` — Zod parse/safeParse boundary tests
- [ ] `src/lib/recommend/__tests__/seeded-e2e.test.ts` — E9 seeded 12×7 + snapshot (requires Postgres)
- [ ] `npx shadcn add slider accordion card` — install missing UI components before Wave 2

*All Wave 0 files must exist before any Wave 1 tasks commit.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /recommend page: stepper counters increment/decrement correctly | CONS-01 | Client-side UI state; no automated DOM test | Navigate to /recommend; click + / − on each capability counter; verify count changes and submit triggers API call |
| Weight sliders affect score ordering (not NSI badge visibility) | CONS-04, CONS-02 | Visual ordering; requires live DB data | Set ukOwnership=0; foreign-owned firm NSI badge must still appear; change contractRelevance to 100; verify top result changes |
| Lock firms & recompute shows different alternatives | CONS-05 | End-to-end user interaction | Submit default recommendation; lock one firm; click "Lock & recompute"; verify alternatives change while locked firm stays |
| /report page renders without error in browser | CONS-01–05 | RSC render requires running Next.js server | `npm run dev`; navigate to /report; verify recommendation card renders with reasoning |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (unit suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
