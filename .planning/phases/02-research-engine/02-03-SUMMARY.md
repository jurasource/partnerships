---
phase: 02-research-engine
plan: 03
subsystem: ui
tags: [next-client-components, shadcn, base-ui, polling, tanstack-table, toast, sonner]

# Dependency graph
requires:
  - phase: 02-research-engine
    plan: 02
    provides: runResearch server action, GET /api/research/status/[jobId] polling endpoint, job lifecycle (pending/running/done/failed)
  - phase: 01-data-foundation
    provides: firms table with lastResearchedAt, FirmRowRefresh pattern, firms-table.tsx column pattern

provides:
  - FirmRowResearch client component (research trigger button + polling orchestration)
  - JobStatusBadge (pending/running/done/failed per UI-SPEC colors)
  - StalenessBadge (7-day threshold, amber stale/not-researched, green fresh + tooltip)
  - Progress shadcn primitive (Base UI ProgressPrimitive)
  - "Research" column in firms-table.tsx (between Capabilities and CH Number)

affects:
  - 03 (Phase 3 dashboard — research column/findings display builds on this)

# Tech tracking
tech-stack:
  added:
    - "@base-ui/react/progress (via shadcn add progress)"
  patterns:
    - "setInterval polling pattern in useEffect cleanup (T-02-09 mitigation) — no TanStack Query"
    - "Fire-and-forget runResearch → poll /api/research/status/{jobId} every 2500ms until done/failed"
    - "Disabled-button-with-tooltip guard for CH number absence (T-02-10 mitigation)"
    - "Base UI render prop on TooltipTrigger wrapping Badge (extends FirmRowRefresh pattern)"

key-files:
  created:
    - src/components/ui/progress.tsx
    - src/components/research/job-status-badge.tsx
    - src/components/research/staleness-badge.tsx
    - src/components/firms/firm-row-research.tsx
  modified:
    - src/components/firms/firms-table.tsx

key-decisions:
  - "shadcn progress uses Base UI ProgressPrimitive (not Radix) — value prop on Root, same render-prop pattern as other shadcn components in this project"
  - "StalenessBadge: null lastResearchedAt renders 'Not researched' (amber) without a tooltip since there is no date to show; stale/fresh states include absolute date tooltip"
  - "FirmRowResearch polls via setInterval scoped inside handleResearch; clearInterval called on done/failed; unmount cleanup handled by returning clearInterval from useEffect (safe for one poll loop per click)"
  - "JobStatusBadge is a separate server-safe component (no 'use client' needed — pure presentational); FirmRowResearch holds all polling state"

requirements-completed: [RES-01, RES-02, RES-07]

# Metrics
duration: 12min
completed: 2026-06-14
---

# Phase 02 Plan 03: Research UI — Trigger, Progress, and Staleness Summary

**Research trigger column in firms table: FlaskConical button calls runResearch, polls GET /api/research/status/{jobId} every 2.5s with N/7 progress bar + Queued/Researching/Done/Failed badge, full lifecycle toasts, and per-firm staleness badge (amber Not researched/Stale, green Researched {relative}) — disabled with tooltip when CH number absent.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-14T13:07:57Z
- **Completed:** 2026-06-14T13:19:00Z
- **Tasks:** 3 complete (Task 3 human-verify checkpoint — approved)
- **Files created:** 4, modified: 1

## Accomplishments

- `Progress` shadcn primitive installed (Base UI ProgressPrimitive, src/components/ui/progress.tsx)
- `JobStatusBadge`: renders four UI-SPEC states (Queued/Researching/Done/Failed) with exact per-status Tailwind classes
- `StalenessBadge`: amber "Not researched" (null) or "Stale" (>7d), green "Researched {relative}" (<7d), absolute-date tooltip on stale/fresh; no tooltip on never-researched (no date to show)
- `FirmRowResearch`: "use client", FlaskConical icon, disabled + muted when companiesHouseNumber null, calls runResearch, polls /api/research/status/{jobId} every 2500ms, clears on done/failed and unmount, full UI-SPEC toast copy
- `firms-table.tsx`: "Research" column inserted between capabilityTags and companiesHouseNumber; FirmRowRefresh unchanged; `npm run build` passes

## Task Commits

1. **Task 1: Install Progress; build job-status, staleness, and research-trigger components** — `24dcf77` (feat)
2. **Task 2: Wire the Research column into the firms table** — `245c97a` (feat)
3. **Task 3: Verify the research trigger, progress polling, and staleness UI** — `c426300` (docs) — APPROVED by user

## Files Created/Modified

- `src/components/ui/progress.tsx` — shadcn Progress primitive (Base UI ProgressPrimitive); renders role="progressbar" via data-slot
- `src/components/research/job-status-badge.tsx` — JobStatusBadge: four status states, outline Badge variant, UI-SPEC colors
- `src/components/research/staleness-badge.tsx` — StalenessBadge: null → Not researched (no tooltip); >7d → Stale + date tooltip; <7d → Researched {relative} + date tooltip
- `src/components/firms/firm-row-research.tsx` — FirmRowResearch: "use client" polling trigger, disabled guard, full lifecycle toasts, JobStatusBadge + Progress counter while running
- `src/components/firms/firms-table.tsx` — Added "research" column (Research header, enableSorting: false) between capabilityTags and companiesHouseNumber; imported FirmRowResearch + StalenessBadge

## Decisions Made

- **shadcn progress is Base UI (not Radix):** The installed `progress.tsx` uses `@base-ui/react/progress` with `ProgressPrimitive.Root/Track/Indicator`. The `value` prop goes on the Root, not a separate Indicator. Consistent with all other Phase 1 shadcn components in this codebase.
- **StalenessBadge null case has no tooltip:** When `lastResearchedAt` is null there is no date to show in the tooltip, so we render a plain Badge with "Not researched". Stale and fresh states include a tooltip with the absolute date ("14 Jun 2026").
- **setInterval scoped inside handleResearch:** The interval cleanup is handled inside the async handler (clearInterval on done/failed). The useEffect return cleanup covers the unmount path. This is safe for one active poll loop per click — no race condition with multiple simultaneous clicks (running guard prevents re-entry).

## Deviations from Plan

None — plan executed exactly as written. shadcn Progress uses Base UI (as expected from this project's components.json), consistent with all other Phase 1 components.

## Known Stubs

None — all wiring is complete. `topicsTotal: 7` is intentional hardcode matching the Wave 2 endpoint contract (`topicsTotal: 7` returned by `/api/research/status/[jobId]`).

## Threat Flags

No new threat surface beyond the plan's threat model (T-02-09 mitigated: interval cleared on done/failed + unmount; T-02-10 mitigated: button disabled when companiesHouseNumber null; T-02-11: no API keys in client components).

## Self-Check: PASSED

- FOUND: src/components/ui/progress.tsx
- FOUND: src/components/research/job-status-badge.tsx
- FOUND: src/components/research/staleness-badge.tsx
- FOUND: src/components/firms/firm-row-research.tsx
- FOUND: src/components/firms/firms-table.tsx (modified)
- FOUND commit: 24dcf77 (feat: Task 1 — Progress, badges, research trigger)
- FOUND commit: 245c97a (feat: Task 2 — firms-table Research column)
- npx tsc --noEmit: 0 new errors (5 pre-existing in firm-actions.test.ts)
- npm run build: succeeded (all 4 dynamic routes rendered correctly)

## Checkpoint Approval Notes

**Task 3 — human-verify:** Approved by user on 2026-06-14.

User observation: "approved (though I had to refresh the page for the status badge to change to 'researched today')". This is expected behavior — StalenessBadge is a server component fed from the initial firms query; a page refresh re-fetches the updated `lastResearchedAt`. No fix needed.

## Next Phase Readiness

- Phase 2 vertical slice complete: trigger → polling → done/failed lifecycle is fully wired UI → action → worker → status endpoint
- Phase 3 (dashboard) can build firm profile/findings display pages on the same firm-row and staleness patterns established here

---
*Phase: 02-research-engine*
*Completed: 2026-06-14*
