---
phase: 04-cross-cutting-analysis
plan: "03"
subsystem: cross-cutting-ui
tags: [cross-cutting, profile-sections, ownership, risk-flags, collaboration, conflicts, partnerships, comparison-table, tdd]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [OwnershipSection, RiskFlagsSection, CollaborationSection, FirmConflictsList, FirmPartnershipsList, getFirmProfile-extended, getComparisonRows-extended, OwnershipBadge]
  affects: [04-04]
tech_stack:
  added: []
  patterns: [tdd-red-green, promise-all-parallel-fetch, or-clause-pair-lookup, server-component-sections, badge-palette-extension]
key_files:
  created:
    - src/components/firms/ownership-section.tsx
    - src/components/firms/risk-flags-section.tsx
    - src/components/firms/collaboration-section.tsx
    - src/components/firms/firm-conflicts-list.tsx
    - src/components/firms/firm-partnerships-list.tsx
  modified:
    - src/lib/queries/firm-profile.ts
    - src/lib/queries/comparison-rows.ts
    - src/lib/queries/firm-profile.test.ts
    - src/lib/queries/comparison-rows.test.ts
    - src/components/firms/firm-profile-page.tsx
    - src/components/dashboard/comparison-table.tsx
    - src/app/firms/[id]/page.tsx
decisions:
  - "[04-03] allFirms for counterpart name resolution fetched in parallel from the route page (app/firms/[id]/page.tsx), not inside getFirmProfile — keeps the query function cohesive"
  - "[04-03] collaborationRecords has no sourceType column — SourceBadge in CollaborationSection hardcoded to AI Research (always correct for that extractor)"
  - "[04-03] isResearched derived from firm.lastResearchedAt !== null — drives the not-researched vs researched-nothing-found empty state fork in all five sections"
  - "[04-03] firm-profile.test.ts updated to 9-call mock pattern matching extended Promise.all; new Test 5 asserts cross-cutting fields"
metrics:
  duration: "7 min"
  completed: "2026-06-15"
  tasks_completed: 1
  tasks_at_checkpoint: 1
  files_modified: 12
  tests_added: 3
---

# Phase 04 Plan 03: Firm Profile Cross-Cutting Sections + Ownership Column Summary

**One-liner:** Extended getFirmProfile/getComparisonRows with cross-cutting joins, five new server-component profile sections (Ownership+CH link, Risk Flags, Collaboration, Conflicts, Partnerships), and a sortable Ownership column on the comparison table — all verified by updated unit tests.

## What Was Built

### Task 1: Extend getFirmProfile + getComparisonRows (TDD — RED/GREEN complete)

- **src/lib/queries/comparison-rows.ts** (extended): Added `ownershipCountry: string | null` to `ComparisonRow`. Third query selects `firmId + countryOfOwnership` from `ownershipRecords`; builds an `ownershipMap`; merged into result with `?? null` default for firms with no record.

- **src/lib/queries/firm-profile.ts** (extended): `FirmProfile` type extended with `ownership: OwnershipRecord | null`, `riskFlags: RiskFlag[]`, `collaboration: CollaborationRecord | null`, `conflicts: ConflictPair[]`, `partnerships: PartnershipPair[]`. Promise.all extended from 3 to 8 parallel queries. Conflict and partnership pair lookups use `or(eq(firmAId, firmId), eq(firmBId, firmId))` to capture both perspectives.

- **src/lib/queries/comparison-rows.test.ts** (extended): Added Tests 4 and 5 asserting `ownershipCountry` is "FR" for a firm with an ownership record and null for a firm without. Updated `buildSelectMock` to handle the 3rd DB call (ownership query). Schema mock extended to include `ownershipRecords`.

- **src/lib/queries/firm-profile.test.ts** (updated): Updated schema mock to include all 5 new cross-cutting tables plus `or` in drizzle-orm mock. `buildSelectMock` updated to handle all 9 DB calls. Added Test 5 asserting cross-cutting fields returned correctly.

**TDD gate:** RED phase confirmed (Tests 4 and 5 fail), GREEN phase confirmed (all 5 tests pass), committed as separate red/green commits.

### Task 2: Five Profile Sections + Ownership Column (implementation complete; awaiting browser verification)

**New server components (no "use client"):**

- **ownership-section.tsx** (`OwnershipSection`): `<dl>` with UK Incorporated badge (green/amber/neutral), Ultimate Parent (or "Not determinable"), Country of Ownership (`OwnershipBadge`), Companies House Number external link to `find-and-update.company-information.service.gov.uk/company/{number}` with `ExternalLink` icon, Source badge. PSC-not-traceable notice when `pscNotTraceable === "yes"`. Empty state: "Run research first to enable ownership analysis." T-04-08: URL pattern hardcoded, only alphanumeric CH number interpolated, `rel="noopener noreferrer"`, "Not recorded" when absent.

- **risk-flags-section.tsx** (`RiskFlagsSection`): Flags sorted High → Medium → Low via `SEVERITY_ORDER`. Each flag: severity badge (red/amber/neutral), description, source title + en-GB date, source URL. Two distinct empty states per Copywriting Contract.

- **collaboration-section.tsx** (`CollaborationSection`): "Prior joint delivery" list (from partnerships passed in) with `PartnershipTypeBadge` (Co-supplier/JV); "Cultural fit signals" in `bg-neutral-50 rounded-md p-3 italic` with AI Research source badge. Resolves counterpart names from `allFirms` map. Two distinct empty states.

- **firm-conflicts-list.tsx** (`FirmConflictsList`): Conflict cards with red `ConflictTypeBadge` (Audit/Competitor), counterpart firm name, evidence summary, source link. T-04-09: researched-empty-state includes exact text "This does not constitute a legal clearance."

- **firm-partnerships-list.tsx** (`FirmPartnershipsList`): Partnership cards with green `PartnershipTypeBadge` (Co-supplier/JV), counterpart name, evidence, source link. Two distinct empty states.

**Existing files extended:**

- **firm-profile-page.tsx**: Now accepts `allFirms: Firm[]` prop. Renders all five new sections below UK Contract History, each with `border-t border-neutral-200`. Derives `isResearched` from `firm.lastResearchedAt !== null`.

- **comparison-table.tsx**: Added `OwnershipBadge` component (green "UK"/amber ISO/neutral "—"). Added `Ownership` column with `accessorKey: "ownershipCountry"`, sortable, placed after Contracts column, with `Tooltip` showing source string. Added `Tooltip/TooltipContent/TooltipTrigger` imports.

- **app/firms/[id]/page.tsx**: Parallel-fetches `allFirms` alongside `getFirmProfile` for counterpart name resolution in conflict/partnership sections.

## Checkpoint Status

Task 2 is at `checkpoint:human-verify`. The full implementation is committed (2d46fe4). Browser verification is required to confirm:
1. Five profile sections render with real data on a researched firm's profile
2. CH external link opens Companies House company page in a new tab
3. Not-researched firm shows "Run research first to enable..." empty states
4. Comparison table Ownership column shows UK/ISO/— badges and sorts correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] firm-profile.test.ts mocks incompatible with extended 9-call Promise.all**
- **Found during:** Task 2 — full test suite after implementing cross-cutting queries
- **Issue:** Existing test mocked only 4 DB calls; extended `getFirmProfile` now makes 9 calls (1 firm lookup + 8 parallel). Schema mock also missing 5 new cross-cutting table stubs.
- **Fix:** Updated `buildSelectMock` to handle all 9 call branches with correct chain shapes (`.where().limit()` for singleton tables, `.where()` for multi-row tables). Added `or` to drizzle-orm mock. Added Test 5 asserting cross-cutting fields present.
- **Files modified:** src/lib/queries/firm-profile.test.ts
- **Commit:** 2d46fe4

**2. [Rule 1 - Bug] CollaborationRecord has no sourceType field**
- **Found during:** Task 2 TypeScript check
- **Issue:** `collaborationRecords` schema only has `sourceUrl`/`sourceTitle`/`rawSnippet` — no `sourceType`. Attempted to render `collaboration.sourceType` caused TS error TS2339.
- **Fix:** `SourceBadge` in `collaboration-section.tsx` hardcoded to "AI Research" (always correct for this extractor); used `sourceUrl !== "not-found"` guard to decide whether to show the badge.
- **Files modified:** src/components/firms/collaboration-section.tsx
- **Commit:** 2d46fe4

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-04-08 | URL pattern hardcoded to `find-and-update.company-information.service.gov.uk/company/`; only alphanumeric CH number is interpolated; `rel="noopener noreferrer"` on link; "Not recorded" rendered when no CH number present |
| T-04-09 | Conflicts empty state (researched) includes exact text "This does not constitute a legal clearance."; only sourced evidence shown in conflict cards |
| T-04-SC | No new packages installed in Plan 03 |

## Known Stubs

None. All sections render from real DB data passed as props. Empty states use distinct copy (never-researched vs researched-nothing-found) per the Copywriting Contract.

## Threat Flags

None. No new network endpoints. New external links in OwnershipSection use hardcoded URL pattern (T-04-08 mitigated). No new trust boundaries beyond the plan's threat model.

## Self-Check: PASSED
