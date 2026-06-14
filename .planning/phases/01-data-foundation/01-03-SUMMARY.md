---
phase: 01-data-foundation
plan: 03
subsystem: uk-data-layer + job-queue + refresh-slice
tags: [api-clients, ocds, companies-house, contracts-finder, find-a-tender, job-queue, server-actions, rate-limiting, vitest, tdd]
dependency_graph:
  requires:
    - schema (src/db/schema.ts → procurementRecords UNIQUE ocid, jobs, firms)
    - db-client (src/db/client.ts → db)
    - types (src/lib/types.ts → Firm)
    - firms-table (src/components/firms/firms-table.tsx → row-action area)
    - firms-dialog (src/components/firms/firm-form-dialog.tsx → stubbed Search CH button)
  provides:
    - http-client (src/lib/clients/http.ts → rateLimitedFetch)
    - ch-client (src/lib/clients/companies-house.ts → getCompanyProfile, getPSC, getOfficers, searchCompanies)
    - cf-client (src/lib/clients/contracts-finder.ts → fetchContractsFinder)
    - fts-client (src/lib/clients/find-a-tender.ts → fetchFindATender)
    - ocds-adapter (src/lib/adapters/ocds.ts → normaliseOcdsRelease, matchFirmToSupplier, upsertProcurementRecords)
    - job-queue (src/lib/jobs/queue.ts → enqueueJob, getJob, updateJobStatus)
    - refresh-action (src/lib/actions/refresh-actions.ts → refreshFirm)
    - ch-search-action (src/lib/actions/ch-search-actions.ts → searchCompaniesAction)
    - firm-row-refresh (src/components/firms/firm-row-refresh.tsx → FirmRowRefresh)
    - ch-search-field (src/components/firms/ch-search-field.tsx → ChSearchField)
  affects:
    - Phase 2 research worker (claims against the enqueue/claim/status job contract)
    - Phase 3 dashboard (reads procurementRecords cache populated by refreshFirm)
tech_stack:
  added:
    - vitest 4.x (dev) — adapter unit tests + npm test script + vitest.config.ts (@ alias)
  patterns:
    - Server-only API clients ('server-only' import) behind a rate-limited fetch wrapper
    - Shared OCDS release type normalised once, reused across CF + FTS
    - Dedup-at-write keyed on UNIQUE ocid via Drizzle onConflictDoNothing (D-09)
    - SQLite job table as a durable enqueue/claim/status queue (D-07/D-08)
    - Server action boundary keeps CH API key server-side (searchCompaniesAction)
    - CH-number-primary firm↔supplier matching, alias fuzzy as secondary signal (DATA-04)
key_files:
  created:
    - src/lib/clients/http.ts — rateLimitedFetch: timeout, 429/5xx backoff+jitter+retry cap, concurrency cap
    - src/lib/clients/companies-house.ts — getCompanyProfile/getPSC/getOfficers/searchCompanies, HTTP Basic, Zod-validated
    - src/lib/clients/contracts-finder.ts — fetchContractsFinder, no-auth OCDS, page/page_size pagination
    - src/lib/clients/find-a-tender.ts — fetchFindATender, no-auth OCDS 1.1.5, links.next cursor pagination
    - src/lib/adapters/ocds.ts — normaliseOcdsRelease, matchFirmToSupplier, upsertProcurementRecords (dedup by ocid)
    - src/lib/adapters/ocds.test.ts — vitest unit tests (normalise, CH-match, dedup-by-ocid, empty-supplier tolerance)
    - src/lib/jobs/queue.ts — enqueueJob/getJob/updateJobStatus (durable SQLite jobs)
    - src/lib/actions/refresh-actions.ts — 'use server' refreshFirm wiring clients + adapter + job
    - src/lib/actions/ch-search-actions.ts — 'use server' searchCompaniesAction (key stays server-side)
    - src/components/firms/firm-row-refresh.tsx — FirmRowRefresh icon button + spinner + toasts
    - src/components/firms/ch-search-field.tsx — ChSearchField live search + auto-fill
    - vitest.config.ts — node env + @ alias
  modified:
    - src/components/firms/firms-table.tsx — mounts FirmRowRefresh in row actions
    - src/components/firms/firm-form-dialog.tsx — replaced stubbed Search button with ChSearchField
    - package.json — vitest dev dep + test script
decisions:
  - "No test runner existed; added vitest as the project's test runner (plan permitted) with a vitest.config.ts @ alias so adapter tests resolve @/ imports"
  - "TDD split into two commits: RED test commit then GREEN implementation commit (Task 1 tdd=true)"
  - "CH search routed through a dedicated server action (searchCompaniesAction) rather than calling the client directly from the dialog, keeping COMPANIES_HOUSE_API_KEY server-side (T-01-08)"
  - "refreshFirm runs synchronously within the action for Phase 1 (single user, manual trigger) but routes through the queue contract so Phase 2 can move it to a worker without changing callers (ARCHITECTURE Decision 1)"
  - "CH profile/PSC fetched during refresh to validate the number and warm the client path; persistence of CH payloads to findings deferred to Phase 2 (Phase 1 has no findings rows)"
metrics:
  duration_minutes: 7
  completed_date: "2026-06-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 12
  files_modified: 3
---

# Phase 01 Plan 03: UK Data Layer, Job Queue, Per-Firm Refresh Summary

**One-liner:** Server-only Companies House / Contracts Finder / Find a Tender clients behind a rate-limited fetch wrapper, a shared OCDS adapter that normalises both procurement sources and dedupes by `ocid` at write time, a durable SQLite job-queue skeleton, and the per-firm `refreshFirm` slice plus a live Search CH field — matched by Companies House number, deduped across sources.

## What Was Built

**Task 1 — UK API clients + OCDS normalise/dedup adapter (TDD; commits `2b0c2a8` RED, `2aa085a` GREEN):**
- `http.ts`: `rateLimitedFetch(url, init, options)` — per-attempt timeout via `AbortController`, retry on 429/5xx with exponential backoff + full jitter (honours `Retry-After`) capped at `maxRetries`, and a process-wide concurrency gate (cap 4) to respect CH's ~600 req/5 min limit (Pitfall 6, T-01-11). `'server-only'`.
- `companies-house.ts`: `getCompanyProfile`, `getPSC`, `getOfficers`, `searchCompanies` — HTTP Basic auth (`COMPANIES_HOUSE_API_KEY` as username, blank password, base64 header), Zod-validated responses (`.passthrough()` tolerant of extra fields), 404→null. Hard-coded GOV.UK base URL; CH number and query URL-encoded into fixed paths (T-01-08/09/10).
- `contracts-finder.ts` (`fetchContractsFinder`) + `find-a-tender.ts` (`fetchFindATender`): no-auth OCDS fetches, explicit pagination (CF page/page_size; FTS `links.next` cursor with same-host guard), safety page cap, return raw OCDS releases.
- `ocds.ts`: `normaliseOcdsRelease(release, sourceApi)` → `NormalisedNotice` (pulls supplier from `awards[].suppliers[]`, tolerates empty names / missing dates / missing value without throwing — Pitfall 3); `matchFirmToSupplier(firm, release)` (CH-number primary signal DATA-04, alias fuzzy canonical-name secondary); `upsertProcurementRecords(firm, releases, sourceApi)` filters to firm-matched releases and upserts with `onConflictDoNothing` keyed on the UNIQUE `ocid` so a notice in both CF + FTS yields one row (D-09/DATA-05), storing normalised columns + full `rawJson` + `sourceApi` (D-10/T-01-12).
- `ocds.test.ts`: 6 vitest assertions — field mapping, empty-supplier/missing-date tolerance, CH-number match, non-match of unrelated firm, dedup-by-ocid yields one row across both sources, only firm-matched releases written. RED first (module missing), then GREEN — all pass.

**Task 2 — SQLite job queue skeleton + refreshFirm action (commit `f0a10fd`):**
- `queue.ts`: `enqueueJob({firmId, topicId?})` inserts a `pending` jobs row (`.returning` the id); `getJob(id)`; `updateJobStatus(id, status, {startedAt?, completedAt?, errorMessage?})` — pending→running→done/failed (D-08). Durable rows persist across restarts (D-07). Enqueue/claim/status only — no AI worker.
- `refresh-actions.ts`: `'use server'` `refreshFirm(firmId)` — loads firm, enqueues + marks job running, fetches CH profile+PSC (when a CH number exists — never invents one, Pitfall 2), fetches CF + FTS in parallel, calls `upsertProcurementRecords` for each source (matched by CH number, deduped by ocid), marks job `done` (or `failed` + `errorMessage` on error), `revalidatePath('/firms')` + `'/'`, returns `{ ok, jobId, error? }`.

**Task 3 — Per-firm refresh control + live Search CH (commit `2426151`):**
- `firm-row-refresh.tsx`: lucide `RefreshCw` icon button calling `refreshFirm(firm.id)`, inline spin animation while running, sonner success ("Procurement data refreshed") or UI-SPEC error toast ("Couldn't load procurement data for this firm…"); mounted in `firms-table.tsx` row actions.
- `ch-search-actions.ts`: `'use server'` `searchCompaniesAction(query)` wraps the CH client so the API key never enters a client component (T-01-08); returns `{ ok, results }` or `{ ok:false, error }`.
- `ch-search-field.tsx`: Search CH button calls `searchCompaniesAction`, renders a results picker, auto-fills the CH number on pick (D-03); manual entry remains primary and the field stays editable (D-02); CH error copy on failure ("Couldn't reach Companies House…").
- `firm-form-dialog.tsx`: replaced the Plan 01 stubbed disabled Search button (+ its Tooltip/Search-icon imports) with `<ChSearchField>`.
- `npm run build` exits 0; `npm test` 6/6 pass.

## Deviations from Plan

### Auto-fixed / environmental

**1. [Adaptation] Added vitest as the project test runner**
- **Found during:** Task 1 (plan instructs: "add vitest as a dev dep if no runner exists").
- **Action:** `npm install -D vitest`, added `vitest.config.ts` (node env + `@`→`./src` alias) and a `test` script. The adapter test mocks `@/db/client` and `@/db/schema` so dedup logic is exercised without touching SQLite.

**2. [`'use server'` directive quote style]**
- The Task 2 verify gate greps for `'use server'` (single quotes); the file uses `"use server"` (double quotes). Both are valid Next.js directives; tsc passes and the build treats the file as a server action. Confirmed with a quote-agnostic grep (`REFRESH_OK`).

**3. [`.env.example` comment skipped — environment restriction]**
- The plan asks to add a comment to `.env.example` noting that live Search CH + refresh require `COMPANIES_HOUSE_API_KEY`. `.env.example` is read/write-restricted in this execution environment (permission-denied). The required `COMPANIES_HOUSE_API_KEY=` line is already present (added in Plan 01, verified in 01-01-SUMMARY self-check), so the functional requirement holds; only the explanatory comment was not added. Task 3 acceptance criteria do not gate on this comment.

No Rule 1/2/4 deviations were required.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| CH profile/PSC fetched but not persisted | `src/lib/actions/refresh-actions.ts` | Phase 1 has no `findings` rows; CH payloads are fetched to validate the number and exercise the client. Persistence of ownership/profile data into findings is Phase 2 (research engine) scope per Phase Boundary. |

This is intentional and scoped to Phase 2 — procurement records (the Phase 1 cache target) ARE written and deduped; CH ownership persistence is explicitly a Phase 2 concern (CONTEXT D-11, findings table populated in Phase 2).

## Threat Surface Scan

No new security surface beyond the plan's threat model. Mitigations implemented:
- **T-01-08** (key disclosure): `COMPANIES_HOUSE_API_KEY` read only in `http.ts`/`companies-house.ts` (`'server-only'`); Search CH and refresh invoked via server actions — key never imported into a client component or logged.
- **T-01-09** (SSRF): client base URLs are hard-coded constants to fixed GOV.UK hosts; only the CH number / search query are user-supplied and URL-encoded into fixed paths; FTS `links.next` cursor is host-guarded to `find-tender.service.gov.uk`.
- **T-01-10** (tampering): API responses Zod-validated; only known fields pulled into typed columns (no spread of untrusted keys); empty/implausible fields tolerated without trust.
- **T-01-11** (DoS): `rateLimitedFetch` enforces concurrency cap + 429/5xx backoff with retry cap; cache-first (refresh is explicit, manual).
- **T-01-12** (provenance): every procurement record stores `sourceApi` + full `rawJson`.

## Self-Check: PASSED

- `src/lib/clients/http.ts` — FOUND, exports `rateLimitedFetch` (backoff + retry cap + concurrency gate)
- `src/lib/clients/companies-house.ts` — FOUND, exports `getCompanyProfile`/`getPSC`/`getOfficers`/`searchCompanies`, HTTP Basic from `COMPANIES_HOUSE_API_KEY`
- `src/lib/clients/contracts-finder.ts` — FOUND, exports `fetchContractsFinder`
- `src/lib/clients/find-a-tender.ts` — FOUND, exports `fetchFindATender`
- `src/lib/adapters/ocds.ts` — FOUND, exports `normaliseOcdsRelease`/`matchFirmToSupplier`/`upsertProcurementRecords` (onConflictDoNothing on ocid)
- `src/lib/adapters/ocds.test.ts` — FOUND, 6/6 pass (dedup-by-ocid, CH-match, empty-supplier tolerance)
- `src/lib/jobs/queue.ts` — FOUND, exports `enqueueJob`/`getJob`/`updateJobStatus`
- `src/lib/actions/refresh-actions.ts` — FOUND, `"use server"`, calls enqueueJob + upsertProcurementRecords + updateJobStatus
- `src/components/firms/firm-row-refresh.tsx` — FOUND, references `refreshFirm`
- `src/components/firms/ch-search-field.tsx` — FOUND, references `searchCompanies`(Action)
- `src/components/firms/firm-form-dialog.tsx` — FOUND, uses `ChSearchField` (stub removed)
- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0
- `npm test` (vitest) — 6/6 pass
- Commits present in git log: 2b0c2a8 (RED), 2aa085a (Task 1 GREEN), f0a10fd (Task 2), 2426151 (Task 3) — all verified

## TDD Gate Compliance

Task 1 (`tdd="true"`): RED commit `2b0c2a8` (`test(01-03): add failing OCDS adapter test`) precedes GREEN commit `2aa085a` (`feat(01-03): UK API clients + OCDS normalise/dedup adapter`). RED was confirmed failing (module-not-found) before implementation; GREEN passes 6/6. No refactor commit needed.
