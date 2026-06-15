# Pending Release Steps

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
