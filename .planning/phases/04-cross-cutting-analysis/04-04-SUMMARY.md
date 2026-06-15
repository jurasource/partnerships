---
phase: 04-cross-cutting-analysis
plan: "04"
subsystem: cross-cutting-analysis-page
tags: [cross-cutting, analysis-page, conflict-matrix, partnership-table, ownership-rollup, jobs-labels, navbar]
dependency_graph:
  requires: [04-03]
  provides: [AnalysisPage, ConflictMatrix, OwnershipRollup, PartnershipTable, getAnalysisPageData, jobType-labels, Analysis-nav-entry]
  affects: []
tech_stack:
  added: []
  patterns: [rsc-force-dynamic, promise-all-parallel-fetch, css-grid-matrix, tanstack-table-partnership, navbar-nav-item-promotion]
key_files:
  created:
    - src/lib/queries/analysis-page.ts
    - src/app/(app)/analysis/page.tsx
    - src/components/analysis/ownership-rollup.tsx
    - src/components/analysis/conflict-matrix.tsx
    - src/components/analysis/partnership-table.tsx
  modified:
    - src/components/app-navbar.tsx
    - src/app/(app)/jobs/page.tsx
    - src/app/api/jobs/route.ts
decisions:
  - "[04-04] Route placed at src/app/(app)/analysis/page.tsx — app uses (app) route group for all authenticated routes; plan's critical_correction noted src/app/ but the actual pattern is (app)"
  - "[04-04] Navbar component is app-navbar.tsx not app-sidebar.tsx — plan referred to sidebar primitives but actual nav is a top bar with NAV_ITEMS/PLACEHOLDER_ITEMS arrays; Analysis promoted from PLACEHOLDER_ITEMS to NAV_ITEMS"
  - "[04-04] OwnershipRollup is a server component (no use client); empty state triggers when zero ownershipRecords exist (not zero firms) to avoid showing the empty state while firms exist but pre-research"
  - "[04-04] ConflictMatrix empty state triggers on allFirms.length < 2 matching the plan spec"
metrics:
  duration: "~20 min"
  completed: "2026-06-15"
  tasks_completed: 1
  tasks_at_checkpoint: 1
  files_modified: 8
  tests_added: 0
---

# Phase 04 Plan 04: /analysis Page + Job Labels + Analysis Nav Entry

**One-liner:** Delivered the /analysis route (ownership roll-up, conflict matrix, partnership table), promoted Analysis from a disabled nav placeholder to an active link, and added Type column to /jobs distinguishing research from cross-cutting-analysis jobs.

## What Was Built

### Task 1 (auto — complete)

- **src/lib/queries/analysis-page.ts** (new): Exports `AnalysisPageData` type and `getAnalysisPageData()` running a `Promise.all` of all four cross-cutting tables (firms, conflictPairs, partnershipPairs, ownershipRecords).

- **src/app/api/jobs/route.ts** (extended): Added `jobType: jobs.jobType` to the select so each row carries the discriminator.

- **src/app/(app)/jobs/page.tsx** (extended): Added `jobType` to `JobRow` type; added "Type" column to `JobTable` rendering "Research" or "Cross-Cutting Analysis" per D-12.

- **src/components/app-navbar.tsx** (extended): Imported `Network` from lucide-react; added `{ label: "Analysis", href: "/analysis", icon: Network }` to `NAV_ITEMS` immediately after Dashboard; removed the disabled "Analysis" entry from `PLACEHOLDER_ITEMS`.

### Task 2 (checkpoint:human-verify — implementation complete)

- **src/app/(app)/analysis/page.tsx** (new RSC): `force-dynamic`, awaits `getAnalysisPageData()`, renders page header (`<h1>` "Cross-Cutting Analysis", subtitle), then three sections separated by `Separator`, each with `id` anchor per UI-SPEC: `id="ownership"`, `id="conflicts"`, `id="partnerships"`.

- **src/components/analysis/ownership-rollup.tsx** (new server component): Computes UK/foreign/unknown counts from ownershipRecords. Renders four stat tiles (`rounded-lg border p-4 flex flex-col gap-1`, count `text-xl font-semibold`, label `text-xs font-semibold uppercase tracking-wide text-neutral-500`). Foreign tile shows per-ISO breakdown in a Tooltip. Empty state fires when `ownershipRecords.length === 0`.

- **src/components/analysis/conflict-matrix.tsx** (new `"use client"`, CSS grid): Symmetric firm × firm grid in `overflow-x-auto`; `gridTemplateColumns: auto repeat(n, minmax(40px, 1fr))`. Diagonal cells `bg-neutral-100` with "—"; flagged pairs `bg-red-50 border border-red-200` with "Audit"/"Competitor" badge; non-conflicted `bg-white`. Firm name headers are Links to `/firms/[id]`; flagged cells are not links.

- **src/components/analysis/partnership-table.tsx** (new `"use client"`, TanStack Table): Mirrors comparison-table.tsx pattern. Columns: Firm A, Firm B (both Links), Type (Co-supplier/JV green badge), Evidence (truncated 60 chars + Tooltip), Source (OCDS sky badge / AI Research violet badge), Date (en-GB `font-mono text-xs`). Default sort: partnershipType asc then evidenceDate desc.

## Deviations from Plan

### Auto-fixed Issues

**1. Route group — `src/app/(app)/` not `src/app/`**
- **Found during:** Implementation
- **Issue:** Plan's critical_correction said `src/app/analysis/page.tsx` but the codebase uses an `(app)` route group for all authenticated routes; all pages are under `src/app/(app)/`.
- **Fix:** Created at `src/app/(app)/analysis/page.tsx` — URL path `/analysis` is unchanged (route groups don't affect URL).

**2. Navbar component — `app-navbar.tsx` not `app-sidebar.tsx`**
- **Found during:** Implementation
- **Issue:** Plan referenced `app-sidebar.tsx` and sidebar primitives. The actual codebase uses `src/components/app-navbar.tsx` with a `NAV_ITEMS` / `PLACEHOLDER_ITEMS` pattern; no shadcn sidebar primitives involved.
- **Fix:** Edited `app-navbar.tsx` accordingly — imported `Network`, added to `NAV_ITEMS`, removed from `PLACEHOLDER_ITEMS`.

## Checkpoint Status

Task 2 is at `checkpoint:human-verify`. Browser verification is required to confirm:
1. `/analysis` is reachable from the Analysis sidebar link; nav item shows active blue state
2. Ownership roll-up tiles show correct counts; foreign tile tooltip shows ISO breakdown
3. Conflict matrix renders as a firm × firm grid; diagonal "—"; flagged pairs red cell with badge; firm name headers link to profiles; grid scrolls horizontally
4. Partnership table renders rows with firm links, type/source badges, en-GB dates; empty state on no data
5. `/jobs` page shows Type column with "Research" / "Cross-Cutting Analysis"

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-04-10 | Only conflict_pairs with stored sourced evidence are flagged; non-flagged cells are blank |
| T-04-11 | overflow-x-auto wrapper + min-w-10 min-h-10 cells per UI-SPEC |
| T-04-SC | No new packages installed |

## Self-Check: PASSED
