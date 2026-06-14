---
phase: "01"
slug: data-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: "2026-06-14"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for the data-foundation phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (node env, `@/` alias → `./src`) |
| **Setup file** | `vitest.setup.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~600ms |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|------|--------|
| 01-01-T2 | 01 | 1 | CONF-01, CONF-06 | T-01-01 | Zod validates createFirm input; Drizzle parameterised insert (no SQL injection) | unit | `npm test` | `src/lib/actions/firm-actions.test.ts`, `src/db/seed.test.ts` | ✅ green |
| 01-01-T3 | 01 | 1 | CONF-01 | T-01-02 | API key not in client components; server-side only | unit | `npm test` | `src/lib/actions/firm-actions.test.ts` | ✅ green |
| 01-01-T4 | 01 | 1 | CONF-06 | — | Seed idempotent; 12 firms + 7 topics | unit | `npm test` | `src/db/seed.test.ts` | ✅ green |
| 01-02-T1 | 02 | 2 | CONF-02, CONF-03 | T-01-05 | updateFirm/deleteFirm use parameterised `eq(firms.id, id)` (no SQL injection) | unit | `npm test` | `src/lib/actions/firm-actions.test.ts` | ✅ green |
| 01-02-T2 | 02 | 2 | CONF-04, CONF-05 | T-01-05 | Topic actions Zod-validated; parameterised Drizzle queries | unit | `npm test` | `src/lib/actions/topic-actions.test.ts` | ✅ green |
| 01-02-T3 | 02 | 2 | D-05 | — | N/A (read-only RSC) | manual | — | — | ⬜ pending |
| 01-03-T1 | 03 | 3 | DATA-01, DATA-02, DATA-03, DATA-04, DATA-05 | T-01-08, T-01-09, T-01-10 | CH key server-side only; URLs hard-coded to GOV.UK; OCDS input Zod-validated; dedup-by-ocid | unit | `npm test` | `src/lib/adapters/ocds.test.ts`, `src/lib/clients/companies-house.test.ts`, `src/lib/clients/contracts-finder.test.ts`, `src/lib/clients/find-a-tender.test.ts` | ✅ green |
| 01-03-T2 | 03 | 3 | D-07, D-08 | — | N/A (SQLite queue, durable) | manual | — | — | ⬜ pending |
| 01-03-T3 | 03 | 3 | D-03 | T-01-08 | searchCompaniesAction keeps key server-side | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Test Files Summary

| File | Requirements | Tests |
|------|-------------|-------|
| `src/lib/actions/firm-actions.test.ts` | CONF-01, CONF-02, CONF-03 | 13 |
| `src/lib/actions/topic-actions.test.ts` | CONF-04, CONF-05 | 11 |
| `src/db/seed.test.ts` | CONF-06 | 9 |
| `src/lib/clients/companies-house.test.ts` | DATA-03 | 14 |
| `src/lib/clients/contracts-finder.test.ts` | DATA-01 | 10 |
| `src/lib/clients/find-a-tender.test.ts` | DATA-02 | 11 |
| `src/lib/adapters/ocds.test.ts` | DATA-04, DATA-05 | 6 |
| **Total** | | **74 automated** |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard comparison table renders from RSC DB query | D-05 | UI/browser verification | `npm run dev` → navigate to `/` → confirm firm table with capability badges and CH numbers renders; add a firm → table refreshes |
| Per-firm refresh control writes job row + procurement records | D-07, D-08 | Network I/O + SQLite; requires live CH API key | Set `COMPANIES_HOUSE_API_KEY` in `.env.local`; `npm run dev` → Firms → click refresh on a seeded firm → verify spinner, toast, and `SELECT count(*) FROM jobs WHERE status='done'` in SQLite |
| Search CH auto-fills company number | D-03 | Live CH API + browser interaction | `npm run dev` → Add Firm → type a company name in Search CH field → confirm results appear and selecting auto-fills the CH number field |

---

## Validation Audit 2026-06-14

| Metric | Count |
|--------|-------|
| Gaps found | 9 |
| Resolved (automated) | 9 |
| Escalated to manual | 0 |
| Pre-existing coverage | 2 (DATA-04, DATA-05) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are recorded as manual-only
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0: all 9 gaps resolved — 6 new test files + existing adapter tests
- [x] No watch-mode flags in test commands
- [x] Feedback latency < 1s (vitest runs in ~600ms)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-14
