---
created: 2026-06-14T09:00:00Z
title: Access-code auth gate for the site
area: auth
files:
  - src/db/schema.ts
  - src/app/layout.tsx
---

## Problem

The site has no authentication. Once hosted, anyone with the URL can access firm intelligence data. It needs to be gated behind a login form where the user enters a pre-generated access code.

## Solution

Simple single-factor access-code auth (no email/password, no OAuth):

1. **DB schema addition** — add an `access_codes` table to `src/db/schema.ts`: `code` (text, hashed), `label` (text — human label for the code, e.g. "Luke"), `createdAt`, `expiresAt` (nullable), `lastUsedAt`, `active` (boolean).

2. **Code generation CLI/script** — a small script (`scripts/generate-code.ts` or an admin server action) that generates a cryptographically random code (e.g. `crypto.randomBytes(16).toString('hex')`), hashes it (bcrypt or `crypto.scrypt`), stores the hash in the DB, and prints the plaintext code once for the operator to share.

3. **Login page** — `src/app/login/page.tsx`: a simple form with a single "Access code" input. On submit, calls a server action that hashes the input and checks it against the `access_codes` table (`active=true`, not expired). On success, sets a signed `HttpOnly` session cookie (use `iron-session` or Next.js `cookies()` + a secret). On failure, returns a generic "Invalid code" error (no timing leak).

4. **Middleware guard** — `src/middleware.ts`: intercept all requests (except `/login` and static assets), check for the session cookie, redirect to `/login` if absent or invalid.

The session secret goes in `.env.local` (`SESSION_SECRET=...`). The `access_codes` table stores hashes only — the plaintext code is never persisted.

This is appropriate for a single-user / small-team internal tool. If multi-user or role-based access is ever needed, migrate to a proper auth provider (Auth.js, Clerk, etc.).
