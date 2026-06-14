---
created: 2026-06-14T09:00:00Z
title: Project docs viewer — render all .md files online with navigation
area: ui
files:
  - src/app/docs/page.tsx
---

## Problem

The `.planning/` directory contains rich project documentation (ROADMAP, REQUIREMENTS, phase plans, research, context decisions, etc.) that is only readable locally. When the app is hosted, there's no way to browse or read these docs without cloning the repo.

## Solution

Add a `/docs` route to the Next.js app that reads and renders all `.md` files from `.planning/` (and optionally root-level docs like `CLAUDE.md`):

1. **Route**: `src/app/docs/[[...slug]]/page.tsx` — dynamic catch-all route that maps URL slugs to file paths under `.planning/`.

2. **File discovery**: At build time (or request time via RSC), use `fs.readdirSync` recursively on `.planning/` to build a file tree. Group by directory (phases, research, todos, etc.).

3. **Sidebar navigation**: Left-hand tree nav listing all discovered `.md` files, grouped by folder, with expand/collapse. Active file highlighted. Reuses the existing shadcn sidebar primitive.

4. **Markdown rendering**: Use `next-mdx-remote` or `remark`/`rehype` pipeline (`rehype-highlight` for code blocks, `remark-gfm` for tables + task lists). Render each file's content in the main panel.

5. **Auth gate**: The `/docs` route must sit behind the same access-code session check as the rest of the app (see auth-gate todo).

6. **Breadcrumb + page title**: Derive from file path (e.g. `phases/01-data-foundation/01-PLAN.md` → "Phases / 01 Data Foundation / Plan").

Nice-to-have: search across all docs using a simple client-side fuzzy filter on titles.

Dependencies: auth-gate todo must be done first if docs are sensitive; Next.js `fs` access works in RSC + server actions.
