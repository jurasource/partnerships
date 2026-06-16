# Pending Release Steps

## feat(research): prompt caching, source transparency, and UI polish

### Dev
- Run `npm run db:push` to add the `search_results` column to the `findings` table

### Prod
- Run `npm run db:push` (or equivalent migration) to add `search_results` column
- Re-run research on existing firms to populate `search_results` (old rows show only cited URLs in sidebar until re-researched)
## chore: commit Drizzle migration 0003 (ch_snapshots table)

### Dev
- Run `npm run db:push` or `npx drizzle-kit migrate` to apply migration 0003 if not already applied.

### Prod
- Apply migration 0003 before deploying: `npx drizzle-kit migrate`.

## fix(05): Phase 5 code-review fixes — scorer correctness, safe JSON parsing, UI + test fixes

### Dev
- No schema changes required.
- Run `npm test` to verify all 198 tests pass.
- The snapshot for `seeded-e2e.test.ts` is now obsolete (scorer normalisation changed); update with `npx vitest run --update-snapshots` against a seeded DB.

### Prod
- No migration required — logic-only changes; deploy new build.

## Phase 5 — /report page + E9 seeded integration test

### Dev
- Run `docker compose up -d db` and `npm run db:push && npm run db:seed` (idempotent) before running the E9 seeded test; `npm test` must be green.
- For the E9 test to execute (not skip), set `DATABASE_URL` in your environment pointing to the seeded Postgres instance.
- `/report` is read-only — no new migrations required.

### Prod
- No schema changes — `/report` reads from existing Phase 1–4 tables; read-only.
- No new env vars required beyond the existing `DATABASE_URL`.

## Phase 5 — /recommend page + navbar links

### Dev
- /recommend and /report nav links now live; no migration required

### Prod
- /recommend and /report nav links now live; no migration required

## Phase 5 — consortium recommender API

### Dev
- Ensure Postgres is running (`docker compose up -d db`); no migration needed (Phase 5 is read-only — reads from existing firms, conflictPairs, partnershipPairs, ownershipRecords, riskFlags, procurementRecords tables)
- No new env vars required

### Prod
- No migration required — Phase 5 reads from tables created in Phases 1–4; no schema changes
- No new env vars required; deploy new build

## fix(analysis): group/capability filter freeze on prod — set modal={false}

### Dev
- No steps required — UI change only

### Prod
- Deploy new build; no schema or env changes needed

## feat: 2-step Add/Edit Firm wizard with Companies House search-first UX

### Dev
- No migrations required (`aliases` column already exists as JSON text)
- Ensure `COMPANIES_HOUSE_API_KEY` and `ANTHROPIC_API_KEY` are set in `.env.local`
- The `generateAliasesAction` uses `claude-opus-4-8` — verify Anthropic API key has access

### Prod
- Same env vars required: `COMPANIES_HOUSE_API_KEY`, `ANTHROPIC_API_KEY`
- No DB migrations needed

## refactor: CH refresh as dedicated BullMQ job

### Dev
- Restart the worker process (`npm run worker`) to pick up the new `ch-refresh` queue worker
- No schema changes — `jobType` is stored as text; the new `"ch-refresh"` value is just a new string
- Existing firms will have CH refresh triggered automatically on next research run
- Use "Refresh CH Data" button on firm profile pages, the Building2 icon on the firms table, or the Jobs page batch submit ("CH Refresh" option) to trigger standalone CH refreshes

### Prod
- Restart/redeploy the worker service to pick up the new `ch-refresh` queue

## fix: CH snapshot silent failure + Refresh CH Data button

### Dev
- Run `npm run db:push` to ensure `ch_snapshots` table exists (if not already done)
- Use the new "Refresh CH Data" button on any firm profile page to fetch and cache CH data immediately (no queue required)
- Alternatively, "Re-run Analysis" still refreshes CH data as part of the cross-cutting job

### Prod
- Same: `npm run db:push` then use "Refresh CH Data" buttons per firm

## fix(CH panel): distinguish "no CH number" from "no snapshot yet"

### Dev
- No steps required — UI change only

### Prod
- No steps required

## feat: cache Companies House data in DB; show CH name on firm profile

### Dev
- Run `npm run db:migrate` to apply the new `ch_snapshots` migration
- Re-run cross-cutting analysis on existing firms to populate the CH snapshot ("Re-run Analysis" on each profile)

### Prod
- Run `npm run db:migrate` before deploying
- Re-run cross-cutting analysis for all firms after deploying

## feat: Companies House data panel on firm profile page

### Dev
- No schema changes, no env changes
- No migrations needed
- CH data is fetched live from the Companies House API on each firm profile page load; requires `COMPANIES_HOUSE_API_KEY` to be set

### Prod
- No deployment steps required beyond deploying the new build
- Ensure `COMPANIES_HOUSE_API_KEY` is set in the production environment

## feat: shared filter bar on analysis page, PSC ownership bug fix, batch job submission, db:migrate script

### Dev
- No schema changes
- Run `npm run db:migrate` instead of `db:push` for future schema changes (new script added)
- Re-run cross-cutting analysis on existing firms to pick up the PSC ownership fix ("Re-run Analysis" button on each firm profile)

### Prod
- Set Railway pre-deploy command to `npm run db:migrate` (safe, idempotent, non-interactive)
- After deploying, use the Jobs page → "Submit batch jobs" → select all firms → "Analysis only" to re-derive ownership records with the corrected PSC logic

## feat: store unresolved JV leads and surface them on firm profiles

### Dev
- Run `npm run db:push` to create the `jv_leads` table (requires Postgres running via `docker compose up -d db`)
- Re-run cross-cutting analysis on any firm that previously logged "Discarding unresolvable JV partner" — the leads will be stored on the next extraction pass

### Prod
- Run `npm run db:push` (or apply migration) against the production database before deploying


## feat(04): Phase 4 Wave 4 — /analysis page, conflict matrix, partnership table, ownership roll-up

### Dev
- No steps required — DB tables (conflictPairs, partnershipPairs, ownershipRecords) already exist from earlier phases

### Prod
- No steps required — no schema changes; deploy new build


## fix(03.1): WR-04 updateGroup now revalidates the specific group detail path

### Dev
- No steps required — server-side only change

### Prod
- No steps required — deploy new build

## fix(03.1): WR-03 add UNIQUE constraint on groups.name

### Dev
- Run `npm run db:push` to apply the new unique index to the local Postgres database

### Prod
- Run `npm run db:push` (or equivalent migration) to add the unique index to the production database — existing rows are unaffected unless duplicates already exist

## fix(03.1): WR-02 add router.refresh() to GroupsTable after delete

### Dev
- No steps required — client-side only change

### Prod
- No steps required — deploy new build

## fix(03.1): WR-01 add router.refresh() to GroupFormDialog after create

### Dev
- No steps required — client-side only change

### Prod
- No steps required — deploy new build

## feat(03.1-03): firms table Groups column + unified filter bar

### Dev
- No schema changes — groups and firm_groups tables were created in Plan 01 (03.1-01)
- The firms page now shows a Groups column with amber pill links; a filter bar above the table allows filtering by Group, Capability, and Research status

### Prod
- No schema changes required; deploy new build

## feat(03.1-02): Groups management area — list page, create dialog, detail page

### Dev
- No schema changes — tables were created in Plan 01 (03.1-01)
- Navigate to `/groups` to see the new Groups section

### Prod
- No schema changes required; deploy new build

## feat(03.1-01): groups + firmGroups data layer — schema, types, server actions

### Dev
- Run `npx drizzle-kit push` (or `npm run db:push`) to create the `groups` and `firm_groups` tables in Postgres

### Prod
- Run `npx drizzle-kit push` against the production database to create `groups` and `firm_groups` tables — no existing data is affected, these are new tables

## fix(redis): support REDIS_URL in addition to REDIS_HOST/REDIS_PORT

### Dev
- No steps required — existing `REDIS_HOST`/`REDIS_PORT` in `.env.local` continues to work

### Prod (Railway)
- Set `REDIS_URL` env var on both the web and worker services (Railway Redis addon provides this automatically)
- `REDIS_HOST`/`REDIS_PORT` can be removed once `REDIS_URL` is set

## feat(multi-source-citations): support multiple source citations per research finding

### Dev
- Run `npm run db:push` after executing this plan (adds `citations` column to `findings` table)

### Prod
- Run `npm run db:push` (or equivalent migration) to add `citations` column to `findings` table — existing rows get the column default (`[]`), no data loss

## feat(auth-gate): complete access-code auth gate

### Dev
- Ensure `SESSION_SECRET` is set in `.env.local` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- Ensure `DATABASE_URL` is set in `.env.local`
- Run `npm install` to get `iron-session@8.0.4`
- Run `DATABASE_URL=... npx drizzle-kit push` to create the `access_codes` table
- Generate at least one access code: `npx tsx --env-file .env.local src/scripts/generate-access-code.ts --label "YourName"`
- Start the app: `npm run dev` and visit `/` — should redirect to `/login`
- Enter the generated code — should redirect to `/` and stay authenticated on refresh

### Prod
- Add `SESSION_SECRET` env var (32+ random bytes, hex string) to deployment environment
- Run `npm run db:push` against production database to create `access_codes` table
- Generate at least one access code before deploying
- All routes except `/login` are now behind the access-code gate

## feat(ui-redesign-analytics): top navbar, redesigned styles, Umami analytics

### Dev
- No new dependencies or schema changes
- Add to `.env.local` if you want to test Umami locally (leave empty to disable):
  - `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<uuid-from-umami-dashboard>`
  - `NEXT_PUBLIC_DOMAIN=<your-domain>`
- Run `npm run dev` — sidebar is gone, top navbar is in place

### Prod
- Add `NEXT_PUBLIC_UMAMI_WEBSITE_ID` env var (get from Umami dashboard → Website → Tracking code)
- Add `NEXT_PUBLIC_DOMAIN` env var (e.g. `partnerships.example.com`) to restrict tracking to prod only

## feat(ui-icons): network icon in navbar and favicon

### Dev
- No steps required — icons are static files already in /public

### Prod
- No steps required

## fix(research-token-limit): raise output token ceiling, retry on truncation, split error sentinel

### Dev
- No schema changes, no env changes required

### Prod
- No steps required — change is worker logic only

## fix(ownership): derive ukIncorporated from CH profile.jurisdiction so empty-PSC LLPs are recognised as UK-incorporated

### Dev
- No schema changes, no env changes required
- Existing firms with empty PSC registers (LLPs) that were previously marked `unknown` will be corrected on next analysis run; the affected live row (Baringa OC303471) was already re-run during the fix

### Prod
- No steps required — change is analysis/worker logic only
- Optional: re-run analysis for LLP firms to refresh any previously `unknown` ukIncorporated values

## fix(analysis): prevent PartnershipTable infinite render loop
### Dev
- No steps required
### Prod
- No steps required

## fix(rate-limit): stagger batch job submission to prevent LLM token burst
### Dev
- No steps required — stagger is applied automatically when submitting batch jobs
### Prod
- No steps required

## feat(research): Anthropic prompt caching on research worker grounding block
### Dev
- No steps required — caching is applied automatically by the worker
### Prod
- No steps required

## fix(tests): resolve TypeScript type errors in test files
### Dev
- No steps required
### Prod
- No steps required

## feat(request-log): add request_logs table and /request-logs UI
### Dev
- `npm run db:push` to apply migration `0004_damp_princess_powerful` (adds `request_logs` table and `findings.search_results` column)
### Prod
- Run migration `0004_damp_princess_powerful.sql` against production Postgres before deploying

## feat(request-logs): replace sidebar drawer with rich modal detail view
### Dev
- No steps required — UI change only
### Prod
- No steps required — deploy new build

## feat(consortium): rename Recommend → Consortium, add group scoping, AI Prompt Builder
### Dev
- No DB migrations required
- `ANTHROPIC_API_KEY` must be set (already required for research worker)
- The `/recommend` route no longer exists; the nav and all links now point to `/consortium`
### Prod
- No DB migrations required
- Ensure `ANTHROPIC_API_KEY` is set in production environment (used by new `/api/consortium-prompt` route)
