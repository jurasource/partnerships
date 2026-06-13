---
phase: 01-data-foundation
plan: 01
subsystem: scaffold + schema + app-shell
tags: [scaffold, drizzle, sqlite, next.js, shadcn, tanstack-table, server-actions]
dependency_graph:
  requires: []
  provides:
    - db-client (src/db/client.ts → exports db)
    - schema (src/db/schema.ts → firms, topics, procurementRecords, jobs, findings)
    - types (src/lib/types.ts → Firm, Topic, ProcurementRecord, Job, Finding, CapabilityTag)
    - server-action-createFirm (src/lib/actions/firm-actions.ts → createFirm)
    - app-shell (src/components/app-sidebar.tsx → AppSidebar)
    - firms-route (src/app/firms/page.tsx → RSC DB read)
    - firms-table (src/components/firms/firms-table.tsx → FirmsTable)
    - firms-dialog (src/components/firms/firm-form-dialog.tsx → FirmFormDialog)
  affects:
    - All subsequent plans (schema is the shared data contract)
tech_stack:
  added:
    - Next.js 16.2.9 (App Router)
    - React 19.2.4
    - TypeScript 6.x
    - Tailwind CSS 4.x
    - shadcn/ui (Base UI-based, New York style) — button, dialog, input, label, badge, table, sidebar, tabs, select, sonner, skeleton, tooltip, dropdown-menu, separator
    - better-sqlite3 12.x + drizzle-orm 0.45.x
    - drizzle-kit 0.31.x + tsx 4.x
    - @tanstack/react-table v8
    - lucide-react 1.x
    - zod 4.4.x
  patterns:
    - RSC direct DB read (dashboard reads SQLite without API hop)
    - Server Action with Zod validation + Drizzle parameterised insert
    - shadcn Base UI render prop pattern (no asChild — 2025 shadcn redesign)
    - Drizzle-kit push for local dev schema management
    - Idempotent seed file (skip if firms table non-empty)
key_files:
  created:
    - src/db/schema.ts — 5-table Drizzle schema (firms, topics, procurementRecords, jobs, findings)
    - src/db/client.ts — better-sqlite3 + Drizzle singleton, reads DATABASE_PATH env
    - src/db/seed.ts — 12 firms + 7 topics (CH numbers confirmed where possible, null+TODO otherwise)
    - src/lib/types.ts — CapabilityTag union + InferSelectModel row types
    - src/lib/actions/firm-actions.ts — createFirm server action (Zod + Drizzle insert)
    - src/components/app-sidebar.tsx — persistent collapsible sidebar (icon rail, tooltips)
    - src/components/firms/firms-table.tsx — TanStack Table with sortable columns + capability badges
    - src/components/firms/firm-form-dialog.tsx — Add Firm dialog with validation
    - src/app/firms/page.tsx — RSC: db.select().from(firms), renders table or empty state
    - src/app/topics/page.tsx — placeholder page
    - src/app/page.tsx — Dashboard landing with empty state
    - drizzle.config.ts — sqlite dialect, ./data/app.db
    - .env.example — COMPANIES_HOUSE_API_KEY + DATABASE_PATH
  modified:
    - src/app/layout.tsx — SidebarProvider + SidebarInset + Toaster + TooltipProvider
    - package.json — db:push and db:seed scripts; renamed to firm-intelligence-dashboard
    - .gitignore — added data/ + !.env.example
decisions:
  - Used Next.js 16.2.9 (create-next-app latest) — plan specified 15.x but 16 was scaffolded; identical App Router API, no plan rework needed
  - shadcn 2025 uses Base UI not Radix — all components use render prop for composition (no asChild); adapted all components to this API
  - Zod v4.4.x installed — uses .issues not .errors; updated firm-actions.ts accordingly
  - 3 of 12 firms have null CH numbers (Framatome UK, GE Hitachi, Orano UK) — cannot confirm registered entity from public sources; seed comments note requirement for human verification per Pitfall 2 guidance
  - node_modules required full clean reinstall — initial rsync copy from /tmp scaffolded broken .bin symlinks; npm install fixed
metrics:
  duration_minutes: 11
  completed_date: "2026-06-13"
  tasks_completed: 3
  tasks_total: 3
  files_created: 22
  files_modified: 4
---

# Phase 01 Plan 01: Walking Skeleton — Scaffold, Schema, App Shell Summary

**One-liner:** Next.js 16 + Drizzle/SQLite walking skeleton with 5-table schema, 12-firm seed, persistent sidebar, RSC firm list read from SQLite, and Add Firm dialog writing via server action.

## What Was Built

Tasks 2, 3, and 4 executed sequentially (Task 1 was approved by the user prior to this agent run):

**Task 2 — Scaffold, Schema, Seed, DB Client:**
- Created Next.js 16.2.9 project via `npx create-next-app@latest` (scaffolded to /tmp, merged to project directory, then clean npm install)
- Installed: `better-sqlite3`, `drizzle-orm`, `zod`, `@tanstack/react-table`, `lucide-react`, `drizzle-kit`, `@types/better-sqlite3`, `tsx`
- `src/db/schema.ts`: all 5 Drizzle tables per the interfaces contract — `firms` (JSON aliases + capabilityTags), `topics`, `procurementRecords` (UNIQUE ocid, rawJson text, D-09/D-10), `jobs` (nullable topicId, status enum D-08), `findings` (sourceUrl/sourceTitle/rawSnippet NOT NULL, confidence enum D-11)
- `src/db/client.ts`: better-sqlite3 singleton + Drizzle, reads `DATABASE_PATH ?? './data/app.db'`, ensures data/ dir exists
- `src/lib/types.ts`: `CapabilityTag` union + Drizzle `InferSelectModel` row types
- `src/db/seed.ts`: 12 firms (9 with confirmed CH numbers, 3 null+TODO), 7 topics, idempotent
- `drizzle.config.ts`, `.env.example`, `db:push` + `db:seed` npm scripts

**Task 3 — App Shell, Firms Screen, Add Firm Dialog:**
- `npx shadcn@latest init` (New York style, neutral, CSS variables) + all Phase 1 components
- `src/components/app-sidebar.tsx`: collapsible to 56px icon rail; Dashboard/Firms/Topics nav with blue-600 active indicator + tooltips; Analysis/Consortium disabled placeholders
- `src/app/layout.tsx`: SidebarProvider + SidebarInset + Toaster + TooltipProvider
- `src/app/firms/page.tsx`: RSC reads `db.select().from(firms)`, renders `FirmsTable` or empty state per UI-SPEC
- `src/components/firms/firms-table.tsx`: TanStack Table — firm name, capability badges (amber/sky/violet), CH number (Geist Mono right-aligned), sortable headers
- `src/components/firms/firm-form-dialog.tsx`: shadcn Dialog with form (name, aliases, CH number, tag multi-select), inline validation, sonner toast, createFirm call
- `src/lib/actions/firm-actions.ts`: `'use server'` createFirm with Zod validation + Drizzle insert + revalidatePath
- Dashboard and Topics placeholder pages per UI-SPEC copywriting contract
- `npm run build` exits 0

**Task 4 — Push Schema + Seed:**
- `drizzle-kit push`: created all 5 tables in `./data/app.db`
- `npm run db:seed`: inserted 12 firms + 7 topics
- Verified: `SELECT count(*) FROM firms = 12`, `SELECT count(*) FROM topics = 7`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Broken .bin symlinks from rsync copy**
- **Found during:** Task 2 verification
- **Issue:** Copying node_modules from /tmp via rsync produced broken `.bin` entries (inline script paths resolved relative to wrong parent). `next`, `tsc`, and other binaries failed with `MODULE_NOT_FOUND`.
- **Fix:** Full clean `npm install` in the project directory after file copy restored all symlinks
- **Files modified:** node_modules (runtime only)

**2. [Rule 1 - Bug] Zod v4 uses .issues not .errors**
- **Found during:** Task 3 TypeScript check
- **Issue:** `parsed.error.errors[0]` — Zod v4 changed the property name from `errors` to `issues`
- **Fix:** Updated `firm-actions.ts` to use `parsed.error.issues[0]`
- **Files modified:** `src/lib/actions/firm-actions.ts`

### Adaptation Notes (not deviations — environmental)

**shadcn 2025 Base UI redesign:**
- The shadcn 2025 release (`shadcn@4.11.0`) uses Base UI instead of Radix primitives. All components use the `render` prop for composition rather than Radix's `asChild`. This is the current stable shadcn API, not a regression.
- Affected: `AppSidebar` (SidebarMenuButton with `render=<Link />`), `FirmFormDialog` (DialogTrigger + TooltipTrigger with `render` prop), `DashboardPage` (Button with `render=<Link />`).
- TypeScript caught all `asChild` incompatibilities; all fixed before commit.

**Next.js 16.2.9 instead of 15.x:**
- `create-next-app@latest` scaffolded Next.js 16. The App Router API is identical for this use case (RSC, Server Actions, `revalidatePath`). No functional difference for Phase 1 tasks.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Search CH button (disabled) | `src/components/firms/firm-form-dialog.tsx` | Live CH `/search/companies` lookup is Plan 03 (D-03). Manual CH entry is the working path. |
| Dashboard comparison table (placeholder) | `src/app/page.tsx` | Full comparison table is Plan 02 scope |
| Topics CRUD | `src/app/topics/page.tsx` | Full Topics CRUD is Plan 02 scope |
| 3 null CH numbers (Framatome UK, GE Hitachi, Orano UK) | `src/db/seed.ts` | Could not confirm registered entity from public CH search; null per Pitfall 2 guidance; TODO comments in seed file |

All stubs are intentional and correctly scoped to future plans as documented in SKELETON.md Out of Scope list.

## Threat Surface Scan

No new security surface beyond the plan's threat model. Mitigations T-01-01 and T-01-02 are implemented:
- T-01-01: `createFirm` validates with Zod before insert; Drizzle uses parameterised queries
- T-01-02: `.env.example` carries no real key; `data/` and `.env.local` gitignored

## Self-Check: PASSED

- `src/db/schema.ts` — FOUND, contains all 5 exports (firms, topics, procurementRecords, jobs, findings)
- `src/db/client.ts` — FOUND, exports db
- `src/db/seed.ts` — FOUND, 12 firms + 7 topics
- `src/lib/types.ts` — FOUND
- `src/lib/actions/firm-actions.ts` — FOUND, contains 'use server' + insert(firms) + revalidatePath
- `src/components/app-sidebar.tsx` — FOUND
- `src/components/firms/firms-table.tsx` — FOUND
- `src/components/firms/firm-form-dialog.tsx` — FOUND, references createFirm
- `src/app/firms/page.tsx` — FOUND, db.select().from(firms)
- `drizzle.config.ts` — FOUND
- `.env.example` — FOUND, contains COMPANIES_HOUSE_API_KEY
- `data/app.db` — EXISTS on disk (gitignored)
- DB counts: firms=12 topics=7 — VERIFIED
- `npm run build` — exits 0 ✓
- `npx tsc --noEmit` — passes ✓
- Commits: 60e561e (Task 2), 5ad62e9 (Task 3), d9a9278 (Task 4) — all present in git log
