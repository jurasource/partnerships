---
phase: 4
slug: cross-cutting-analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PROF-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PROF-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | ANAL-01 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | ANAL-02 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | ANAL-03 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | PROF-05 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | ANAL-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 4 | PROF-07 | — | N/A | manual | browser smoke | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/cross-cutting/__tests__/ownership.test.ts` — stubs for PROF-04 (ownership extraction)
- [ ] `src/lib/cross-cutting/__tests__/conflicts.test.ts` — stubs for ANAL-02 (conflict pair detection)
- [ ] `src/lib/cross-cutting/__tests__/risk-flags.test.ts` — stubs for PROF-05/ANAL-04 (risk flag extraction)
- [ ] `src/lib/cross-cutting/__tests__/co-supplier.test.ts` — stubs for ANAL-03 (co-supplier detection)

Existing vitest infrastructure from Phase 1 covers all phase requirements — no framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ownership nationality badge appears on firm profile card | PROF-04 | Browser DOM interaction | Navigate to /firms/[id], confirm ownership badge visible with country and source |
| Conflict warning panel shows pairs with evidence | ANAL-02 | Multi-firm browser state | Navigate to /analysis, confirm flagged pairs with audit/competitor type labels |
| Risk flags display with severity and dates | PROF-05 | Browser visual verification | Navigate to /firms/[id], confirm risk section shows severity badges and dated sources |
| Partnership history shows on profile | ANAL-03 | Browser visual + data join | Navigate to /firms/[id], confirm co-supplier firms listed with shared contract refs |
| Re-run refresh updates cross-cutting data | ANAL-01 | End-to-end browser flow | Trigger refresh on a firm, confirm analysis job runs and new data appears |

---

## Validation Architecture

From RESEARCH.md:

- **Ownership extraction**: unit tests for `extractOwnership(text, schema)` — test UK-incorporated detection, parent name extraction, country inference from PSC data
- **Risk flag extraction**: unit tests for `extractRiskFlags(text, schema)` — test severity classification (high/medium/low), dated source assertion, stale-flag deletion on re-run
- **Conflict pair detection**: unit tests for canonical pair ordering `(firmAId < firmBId)`, upsert idempotency, sourced evidence requirement
- **Co-supplier detection**: unit tests for SQL join logic — two firms sharing same `ocid` in `procurement_records` returns partnership record
- **Job dispatch**: unit tests for `jobType` discriminator on BullMQ queue — cross-cutting jobs must not be conflated with research jobs

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
