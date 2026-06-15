# Pending Release Steps

## feat(auth-gate): install iron-session, add accessCodes schema, auth helpers

### Dev
- Ensure `SESSION_SECRET` is set in `.env.local` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- Run `npm install` to get `iron-session@8.0.4`
- Run `npm run db:push` (or `DATABASE_URL=... npx drizzle-kit push`) to create the `access_codes` table

### Prod
- Add `SESSION_SECRET` env var (32+ random bytes, hex string) to deployment environment
- Run `npm run db:push` against the production database to create `access_codes` table
