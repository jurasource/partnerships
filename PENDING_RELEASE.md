# Pending Release Steps

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
