# Pending Release Steps

## feat(auth-gate): login page, server action, and code generation script

### Dev
- Ensure `SESSION_SECRET` is set in `.env.local`
- Ensure `DATABASE_URL` is set in `.env.local`
- Run `npm install` to get `iron-session@8.0.4`
- Run `DATABASE_URL=... npx drizzle-kit push` to create the `access_codes` table
- Generate an access code: `npx tsx --env-file .env.local src/scripts/generate-access-code.ts --label "YourName"`
- Start the app: `npm run dev` and visit `/login`

### Prod
- Add `SESSION_SECRET` env var (32+ random bytes, hex string) to deployment environment
- Run `npm run db:push` against production database to create `access_codes` table
- Generate at least one access code before deploying: `npx tsx --env-file .env.local src/scripts/generate-access-code.ts --label "OperatorName"`
