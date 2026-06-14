---
phase: 01-data-foundation
plan: 02
subsystem: config-crud + dashboard-read-view
tags: [server-actions, drizzle, tanstack-table, shadcn, alert-dialog, dialog, rsc]
dependency_graph:
  requires:
    - schema (src/db/schema.ts → firms, topics)
    - db-client (src/db/client.ts → db)
    - types (src/lib/types.ts → Firm, Topic, CapabilityTag)
    - server-action-createFirm (src/lib/actions/firm-actions.ts → createFirm)
    - firms-dialog (src/components/firms/firm-form-dialog.tsx → FirmFormDialog)
    - firms-table (src/components/firms/firms-table.tsx → FirmsTable)
  provides:
    - server-action-updateFirm (src/lib/actions/firm-actions.ts → updateFirm)
    - server-action-deleteFirm (src/lib/actions/firm-actions.ts → deleteFirm)
    - topic-actions (src/lib/actions/topic-actions.ts → createTopic, updateTopic, deleteTopic)
    - topics-table (src/components/topics/topics-table.tsx → TopicsTable)
    - topics-dialog (src/components/topics/topic-form-dialog.tsx → TopicFormDialog)
    - topics-route (src/app/topics/page.tsx → RSC DB read + CRUD)
    - comparison-table (src/components/dashboard/comparison-table.tsx → ComparisonTable)
    - dashboard-route (src/app/page.tsx → RSC firm comparison)
  affects:
    - Plan 03 (per-firm refresh control slots into the firm row-action area reserved here)
tech_stack:
  added: []
  patterns:
    - Edit-mode Dialog (optional entity prop pre-fills fields, swaps submit copy + action)
    - Destructive AlertDialog confirmation gating delete server actions (T-01-06)
    - RSC direct DB read renders client TanStack Table (firms/topics/dashboard)
    - Server Action with Zod validation + parameterised Drizzle update/delete on eq(table.id, id)
key_files:
  created:
    - src/lib/actions/topic-actions.ts — createTopic/updateTopic/deleteTopic ('use server', Zod, parameterised Drizzle, revalidatePath('/topics'))
    - src/components/topics/topic-form-dialog.tsx — add/edit topic Dialog (name required, description)
    - src/components/topics/topics-table.tsx — TanStack Table topic list + edit/delete row actions + destructive AlertDialog
    - src/components/dashboard/comparison-table.tsx — read-only sortable cross-firm comparison (capability badges, mono CH numbers)
  modified:
    - src/lib/actions/firm-actions.ts — added updateFirm + deleteFirm (parameterised, revalidate / and /firms)
    - src/components/firms/firm-form-dialog.tsx — optional firm prop = edit mode ("Save Changes", calls updateFirm)
    - src/components/firms/firms-table.tsx — edit/delete row actions, destructive AlertDialog, refresh slot reserved
    - src/app/topics/page.tsx — real RSC screen (db read, Add Topic CTA, TopicsTable / empty state)
    - src/app/page.tsx — RSC db.select().from(firms) renders ComparisonTable or Dashboard empty state
decisions:
  - "Tasks 1 and 2 were completed and committed in a prior partial run (073987b, 4d44c63); this run resumed at Task 3 — wired the pre-built but untracked ComparisonTable into page.tsx (which still held the Plan 01 placeholder) and committed it"
metrics:
  duration_minutes: 6
  completed_date: "2026-06-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 5
---

# Phase 01 Plan 02: Config CRUD + Dashboard Comparison Table Summary

**One-liner:** Completed the Phase 1 configuration layer — firm edit/delete via Dialog + destructive AlertDialog, full Topics CRUD screen, and the read-only Dashboard cross-firm comparison table loaded from SQLite via RSC.

## What Was Built

This plan was executed across two runs; this agent resumed a partial prior execution.

**Task 1 — Firm edit + delete (committed `073987b`, prior run):**
- `firm-actions.ts` extended with `updateFirm(id, input)` and `deleteFirm(id)` — both Zod-validated, parameterised `db.update`/`db.delete` on `eq(firms.id, id)`, `revalidatePath('/firms')` + `revalidatePath('/')`.
- `FirmFormDialog` accepts an optional `firm` prop → edit mode: pre-fills fields, submit copy becomes **Save Changes**, calls `updateFirm`, toasts "Changes saved". CH numbers remain editable (D-02).
- `FirmsTable` row actions: Edit (opens dialog in edit mode) + Delete (destructive `AlertDialog`, exact UI-SPEC copy "Delete firm?" / "Remove [Firm name] and its cached procurement and research data? This can't be undone." / red **Delete**). Space reserved for the Plan 03 refresh control.

**Task 2 — Topics CRUD screen (committed `4d44c63`, prior run):**
- `topic-actions.ts`: `'use server'` `createTopic`/`updateTopic`/`deleteTopic`, Zod name-non-empty validation, parameterised Drizzle, `revalidatePath('/topics')`.
- `topic-form-dialog.tsx`: shadcn Dialog (topic name required, description), add/edit modes.
- `topics-table.tsx`: TanStack Table (name + description columns) with edit/delete row actions; destructive `AlertDialog` with UI-SPEC copy "Delete topic?" / "Remove [Topic name]? Findings tied to this topic will be removed in future research runs."
- `app/topics/page.tsx`: real RSC screen — `db.select().from(topics)`, "Topics" header + **Add Topic** CTA, `TopicsTable`, empty state when zero rows.

**Task 3 — Dashboard read-only comparison table (committed `45fde87`, this run):**
- `comparison-table.tsx` (pre-built but untracked from the prior run): read-only sortable TanStack Table v8 — canonical name, capability tags (soft-tint badges reusing the firms-table palette), CH number (Geist Mono, right-aligned). No filter/refresh controls (Phase 3 DASH scope).
- `app/page.tsx`: replaced the Plan 01 placeholder — RSC `db.select().from(firms)` renders `<ComparisonTable firms={...} />` when rows exist, else the Dashboard empty state ("No firm data to compare" + link to /firms).
- `npm run build` exits 0; gate `DASH_OK` confirmed.

## Deviations from Plan

### Continuation note (not a deviation)

This agent was spawned against a plan whose Tasks 1 and 2 had already been executed and committed in a prior partial run, with Task 3's `comparison-table.tsx` written to disk but left untracked and `page.tsx` still carrying the Plan 01 placeholder. Resumed at Task 3: verified Tasks 1/2 artifacts against the acceptance criteria (all present and correct), wired `ComparisonTable` into `page.tsx`, verified the build, and committed. No re-implementation of completed tasks.

No auto-fixes (Rules 1–3) were required — the build and TypeScript checks passed on first run.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| No per-firm refresh control | `src/components/firms/firms-table.tsx` | Refresh (CH/CF/FTS re-fetch) is Plan 03 scope; row-action space intentionally reserved per plan instruction. |
| No Dashboard filtering | `src/components/dashboard/comparison-table.tsx` | Filtering is a Phase 3 DASH requirement; Phase 1 Dashboard is explicitly read-only. |
| Search CH button (disabled) | `src/components/firms/firm-form-dialog.tsx` | Inherited from Plan 01; live `/search/companies` lookup is Plan 03 (D-03). |

All stubs are intentional and scoped to future plans per SKELETON.md Out of Scope.

## Threat Surface Scan

No new security surface beyond the plan's threat model. Mitigation T-01-05 is implemented:
- `updateFirm`, `deleteFirm`, `createTopic`, `updateTopic`, `deleteTopic` all Zod-validate input and use parameterised Drizzle `eq(table.id, id)` — no raw SQL interpolation.
- T-01-06 (delete EoP) accepted: destructive actions gated behind `AlertDialog` confirmation; single-user local tool, no auth model.

## Self-Check: PASSED

- `src/lib/actions/firm-actions.ts` — FOUND, exports updateFirm + deleteFirm (parameterised db.update/db.delete on eq(firms.id,id))
- `src/lib/actions/topic-actions.ts` — FOUND, exports createTopic/updateTopic/deleteTopic ('use server', revalidatePath('/topics'))
- `src/components/topics/topics-table.tsx` — FOUND, destructive AlertDialog "Delete topic?"
- `src/components/topics/topic-form-dialog.tsx` — FOUND
- `src/app/topics/page.tsx` — FOUND, db.select().from(topics) + Add Topic CTA
- `src/components/dashboard/comparison-table.tsx` — FOUND, sortable read-only firm table with badges + mono CH numbers
- `src/app/page.tsx` — FOUND, db.select().from(firms) renders ComparisonTable / empty state
- `npm run build` — exits 0 (verified, output above)
- Commits present in git log: 073987b (Task 1), 4d44c63 (Task 2), 45fde87 (Task 3) — all verified
