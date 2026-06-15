# Pending Release Steps

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
