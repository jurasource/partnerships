---
plan: auth-gate
type: quick
phase: quick
subsystem: auth
tags: [auth, session, middleware, iron-session, scrypt, access-code]
dependency_graph:
  requires: []
  provides: [access-code-auth-gate, session-cookie, middleware-guard]
  affects: [all-routes, login-page]
tech_stack:
  added: [iron-session@8.0.4]
  patterns: [scrypt-hash, timingSafeEqual, iron-session, Next.js-middleware, useActionState]
key_files:
  created:
    - src/lib/auth/hash.ts
    - src/lib/auth/session.ts
    - src/lib/auth/constants.ts
    - src/scripts/generate-access-code.ts
    - src/app/login/page.tsx
    - src/app/login/login-form.tsx
    - src/app/login/actions.ts
    - src/app/login/actions.test.ts
    - src/middleware.ts
  modified:
    - src/db/schema.ts
    - PENDING_RELEASE.md
    - RELEASE_NOTES.md
decisions:
  - "Shared SESSION_OPTIONS constant in src/lib/auth/constants.ts prevents cookieName drift between session.ts and middleware.ts"
  - "Middleware at src/middleware.ts (not project root) — correct placement for Next.js src/ layout"
  - "useActionState (React 19) chosen over deprecated useFormState for login form state management"
  - "LoginForm extracted to login-form.tsx as 'use client' component so page.tsx remains a server component"
  - "verifyCode iterates all active candidates (not DB-match by hash) — necessary because hash includes random salt per code"
metrics:
  duration: 5 min
  completed: 2026-06-15
  tasks_completed: 3
  files_created: 9
  files_modified: 3
---

# auth-gate Summary

**One-liner:** Single-factor access-code gate using scrypt+timingSafeEqual hashes, iron-session HttpOnly cookie, and Next.js middleware guard on all routes except /login.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install iron-session + add accessCodes schema + auth helpers | 7f28d11 | src/db/schema.ts, src/lib/auth/hash.ts, src/lib/auth/session.ts |
| 2 | Code generation script + login page + verifyAccessCode action | c8ca877 | src/scripts/generate-access-code.ts, src/app/login/actions.ts, src/app/login/actions.test.ts, src/app/login/page.tsx, src/app/login/login-form.tsx |
| 3 | Middleware guard | 40ff1c5 | src/middleware.ts, src/lib/auth/constants.ts (new), src/lib/auth/session.ts (updated) |

## Success Criteria Verification

- [x] All routes except /login redirect unauthenticated visitors to /login (middleware matcher)
- [x] Valid active unexpired access code grants access via signed HttpOnly session cookie (iron-session)
- [x] Invalid/expired codes return generic error with no information leak ("Invalid access code. Please try again.")
- [x] No plaintext codes in database — only scrypt hashes with random salt
- [x] Operator can generate codes with `npx tsx --env-file .env.local src/scripts/generate-access-code.ts --label "Name"`
- [x] 4 passing vitest tests for verifyAccessCode server action
- [x] Full test suite: 98 tests / 12 test files — all pass

## Deviations from Plan

### Auto-added: Shared SESSION_OPTIONS constant

**Rule 2 — Missing critical functionality (anti-drift)**
- **Found during:** Task 3
- **Issue:** Plan noted that cookieName in middleware must exactly match session.ts — risk of drift if copied separately
- **Fix:** Extracted shared `SESSION_OPTIONS` to `src/lib/auth/constants.ts`; both session.ts and middleware.ts import it
- **Files modified:** `src/lib/auth/constants.ts` (new), `src/lib/auth/session.ts` (updated to import)
- **Commit:** 40ff1c5

### Auto-fixed: TypeScript cast in test file

**Rule 1 — Bug (type error)**
- **Found during:** Task 2 verification
- **Issue:** `redirect as ReturnType<typeof vi.fn>` caused TS2352 type overlap error
- **Fix:** Changed to `redirect as unknown as ReturnType<typeof vi.fn>` with `vi.mocked()` for other mocks
- **Files modified:** `src/app/login/actions.test.ts`
- **Commit:** c8ca877

## Architecture Notes

### Auth Flow

```
User → /any-route → middleware.ts → getIronSession(request, response)
  → session.isAuthenticated? YES → NextResponse.next()
  → session.isAuthenticated? NO  → redirect to /login

/login → LoginForm (client, useActionState) → verifyAccessCode (server action)
  → DB: SELECT active candidates → scrypt compare (timingSafeEqual)
  → match found + not expired → setSession() → iron-session.save() → redirect("/")
  → no match or expired → { error: "Invalid access code. Please try again." }
```

### Security (STRIDE Mitigations Applied)

| Threat | Mitigation |
|--------|------------|
| T-AUTH-01: Timing oracle | `timingSafeEqual` in verifyCode — constant-time comparison |
| T-AUTH-02: Cookie tampering | iron-session signs+encrypts with SESSION_SECRET; tampered cookie rejected |
| T-AUTH-03: Info disclosure | Generic error regardless of whether code exists, is expired, or is wrong |
| T-AUTH-04: /login bypass | Middleware matcher covers all routes; /login excluded by path prefix |
| T-AUTH-05: Supply chain | Only iron-session@8.0.4 added (well-known, maintained package) |

## Known Stubs

None — all paths are wired to real data sources and real session state.

## Threat Flags

None — no new network endpoints or trust boundaries beyond those in the plan's threat model.

## Self-Check: PASSED

All 9 created files verified present on disk. All 3 task commits verified in git log (7f28d11, c8ca877, 40ff1c5). Full test suite: 98/98 tests passing.
