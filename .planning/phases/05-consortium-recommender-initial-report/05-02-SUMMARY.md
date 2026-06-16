---
phase: 05-consortium-recommender-initial-report
plan: "02"
subsystem: recommend-ui
tags:
  - recommend
  - ui
  - shadcn
  - components
  - navbar
dependency_graph:
  requires:
    - 05-01 (RecommendResponse/FirmScoreBreakdown/TeamRecommendation schemas, /api/recommend route)
    - 03-UI-SPEC (design token baseline, badge palette, empty-state pattern)
    - 04-02 (ownership/conflict/risk data powering badges in FirmSubCard)
  provides:
    - /recommend page (RSC shell + RecommendClient island)
    - 7 recommend components (capability-mix-input, weight-sliders, lock-firms-section, firm-sub-card, score-breakdown, no-valid-team-state, recommendation-result)
    - getLockFirmsList() server query
    - Navbar: live Recommend + Report links
  affects:
    - 05-03 (report page will reuse RecommendationResult with readOnly=true)
tech_stack:
  added: []
  patterns:
    - RSC shell + "use client" island for SSR data load with interactive client state
    - Base UI Accordion (no type/collapsible props — always-collapsible by default)
    - Base UI Slider onValueChange receives number | readonly number[] — array variant when value=[] passed
    - Threat-model-driven: NSI badge gated only on ukIncorporated==="no", never on weight value (T-05-07)
key_files:
  created:
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
  modified:
    - src/components/app-navbar.tsx
    - PENDING_RELEASE.md
    - RELEASE_NOTES.md
decisions:
  - "Base UI Accordion does not accept type='single' or collapsible props — the component is always collapsible per item; removed these props from RecommendClient accordion usage"
  - "Base UI Slider onValueChange callback receives number | readonly number[] depending on whether value is scalar or array — handler casts to array and reads index [0]"
  - "RSC shell + client island pattern: getLockFirmsList() runs server-side in page.tsx, result passed as prop to RecommendClient — avoids client-side DB fetch while keeping interactive state in the island"
  - "NSI badge in FirmSubCard guarded only by ownershipRecord.ukIncorporated === 'no' — never by a weight prop (CONS-04, T-05-07 threat mitigation)"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-16"
  tasks_completed: 2
  files_changed: 13
  tests_added: 0
---

# Phase 05 Plan 02: Recommend UI Components Summary

**One-liner:** Full `/recommend` vertical slice — 7 component files, RSC+island page, lock-firms query, and navbar promotion wiring capability-stepper → POST /api/recommend → in-place result with NSI/ownership/conflict/risk badges and lock-and-recompute.

## What Was Built

### Task 2: Recommend input + result components

**src/lib/queries/lock-firms.ts** — `getLockFirmsList()` drizzle select returning `{ id, canonicalName, tags }` ordered alphabetically; `capabilityTags` JSON text column parsed to `string[]`.

**capability-mix-input.tsx** — `CapabilityMixInput` controlled component: three stepper groups (Consultancy/Infrastructure/Nuclear), each with `−`/`+` outline icon buttons (min-h-[44px]), monospace count display (text-neutral-300 when 0), clamped 0–5. Instruction copy matches UI-SPEC exactly.

**weight-sliders.tsx** — `WeightSliders` controlled: four labeled Base UI `Slider` rows (Prior partnerships, UK ownership, Contract relevance, Risk profile), defaults 25 each, live value display in font-mono. Instruction copy matches UI-SPEC.

**lock-firms-section.tsx** — `LockFirmsSection` controlled: alphabetical firm list with checkbox+label, `Lock` lucide icon when checked, capability tag badges (amber/sky/violet palette), name font-medium when locked. Instruction copy matches UI-SPEC.

**firm-sub-card.tsx** — `FirmSubCard`: shadcn Card `bg-white border-neutral-100 p-4`; firm name, capability tag badges, ownership badge (green "UK" when ukIncorporated==="yes", orange ISO country code when "no", neutral "Unknown" when no record), NSI badge (amber "NSI") ONLY when `ukIncorporated === "no"` (T-05-07 — never gated on weight), intra-team conflict badges (red "Conflict"), risk flag count badge colored by highest severity.

**score-breakdown.tsx** — `ScoreBreakdown`: collapsible toggle ("View reasoning" / "Hide reasoning"), per-firm `<table>` with columns "Firm", "Partnerships", "UK Ownership", "Contracts", "Risk", "Total" (font-mono values), "Excluded pairs:" section with `{Firm A} + {Firm B} — {conflictType}` rows.

**no-valid-team-state.tsx** — `NoValidTeamState`: centred empty state (rounded-full bg-neutral-100, Users icon), "No valid consortium found" heading, configurable reason body with fallback to UI-SPEC copy.

**recommendation-result.tsx** — `RecommendationResult`: branches on `status === "no_valid_team"` → `NoValidTeamState`; primary Card (border-blue-200 bg-blue-50/30, "Primary Recommendation" badge, "Recommended Consortium" title, FirmSubCards, ScoreBreakdown footer with lock-and-recompute + Reset unless readOnly); Alternatives grid (grid-cols-1 sm:grid-cols-2, FirmSubCards, no ScoreBreakdown). `readOnly` prop suppresses recompute/Reset actions (for use by report page).

### Task 3: /recommend page wiring + navbar promotion + release docs

**src/app/(app)/recommend/page.tsx** — RSC shell: loads `getLockFirmsList()` server-side, renders `<h1>Consortium Recommender</h1>` header, passes firm list to `RecommendClient` island in `max-w-3xl` content wrapper.

**src/app/(app)/recommend/recommend-client.tsx** — Client island: `capabilityMix` / `lockedFirmIds` / `weights` / `result` / `loading` state. Renders CapabilityMixInput, two collapsed Accordions (lock-firms, scoring-weights), "Get Recommendation" Button (disabled when mix total=0, Loader2 + "Computing..." during request). POSTs to `/api/recommend`; sonner toast `"Could not compute recommendation. {message}."` on error. `onRecompute` sets lockedFirmIds to primary team ids and resubmits; `onReset` clears lockedFirmIds.

**src/components/app-navbar.tsx** — Added `FileText` lucide import; moved "Consortium" → "Recommend" (`href: "/recommend"`, Users icon) into `NAV_ITEMS`; added `{ label: "Report", href: "/report", icon: FileText }`; cleared `PLACEHOLDER_ITEMS` array. Analysis stays in NAV_ITEMS (was already promoted).

**PENDING_RELEASE.md** — Phase 5 /recommend + /report nav links entry appended.

**RELEASE_NOTES.md** — 2026-06-16 bullet appended.

## Verification Results

```
npx tsc --noEmit (recommend components + page + navbar)
  no errors in: src/components/recommend/*, src/lib/queries/lock-firms.ts,
                src/app/(app)/recommend/*, src/components/app-navbar.tsx

npx vitest run --reporter=verbose
  Test Files  20 passed (20)
  Tests  197 passed (197)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Base UI Accordion type/collapsible props incompatibility**
- **Found during:** Task 3 TypeScript compilation
- **Issue:** `<Accordion type="single" collapsible>` (shadcn/Radix API) is not valid for the Base UI Accordion wrapper installed in this project. Base UI Accordion root accepts `multiple` (boolean) instead of `type="single"`, and every item is independently collapsible by default — there is no `collapsible` prop.
- **Fix:** Removed `type="single"` and `collapsible` props from both Accordion instances in `recommend-client.tsx`. The Base UI accordion behavior (single-item expand/collapse) matches the plan's intent.
- **Files modified:** `src/app/(app)/recommend/recommend-client.tsx`
- **Commit:** 7f6fb21

**2. [Rule 1 - Bug] Base UI Slider onValueChange callback type**
- **Found during:** Task 2 — inspecting Base UI slider type definitions
- **Issue:** `onValueChange` receives `number | readonly number[]` (union type based on Value generic), not `number[]` as in shadcn/Radix. Passing the callback `(v: number[]) => void` directly would cause a type mismatch.
- **Fix:** `WeightSliders.handleChange` typed as `(key, newValue: number | readonly number[]) => void` with explicit array-check before reading index [0].
- **Files modified:** `src/components/recommend/weight-sliders.tsx`
- **Commit:** 2f2ebbf

## Known Stubs

None — all components render live data from the `FirmScoreBreakdown` / `TeamRecommendation` types produced by the Plan 01 scorer. No hardcoded placeholder values. The `conflictWith` prop in `FirmSubCard` defaults to `[]` (which is correct for valid teams where conflicts are already excluded by the scorer).

## Threat Flags

No new threat surface beyond what the plan documented:
- T-05-07 (NSI suppression): FirmSubCard renders NSI badge guarded by `ukIncorporated === "no"` only — never gated on any weight prop. Acceptance criteria verified.
- T-05-08 (external links): `lock-firms-section.tsx` and `firm-sub-card.tsx` contain no external `<a>` tags; score-breakdown has none. The plan's source-link pattern applies when source URLs are present — none in this plan's component scope.
- T-05-09 (client bypass): RecommendClient passes raw mix/weights/locks to the API; server re-validates with Zod safeParse (Plan 01 route).

## Self-Check: PASSED

Files exist:
- src/components/recommend/capability-mix-input.tsx: FOUND
- src/components/recommend/weight-sliders.tsx: FOUND
- src/components/recommend/lock-firms-section.tsx: FOUND
- src/components/recommend/firm-sub-card.tsx: FOUND
- src/components/recommend/score-breakdown.tsx: FOUND
- src/components/recommend/no-valid-team-state.tsx: FOUND
- src/components/recommend/recommendation-result.tsx: FOUND
- src/lib/queries/lock-firms.ts: FOUND
- src/app/(app)/recommend/page.tsx: FOUND
- src/app/(app)/recommend/recommend-client.tsx: FOUND
- src/components/app-navbar.tsx: FOUND (modified)

Commits exist:
- 2f2ebbf feat(05-02): recommend UI components + lock-firms query: FOUND
- 7f6fb21 feat(05-02): /recommend page wiring + navbar promotion + release docs: FOUND
