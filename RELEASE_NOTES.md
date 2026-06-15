# Release Notes

## 2026-06-15
- Added mandatory commit and release workflow rules to CLAUDE.md: run tests before committing, update PENDING_RELEASE.md and RELEASE_NOTES.md after each commit, and always branch/PR rather than pushing directly to main
- feat(auth-gate) Task 1: Installed iron-session@8.0.4; added `access_codes` table to schema (scrypt-hashed code store with active/expiry fields); created `src/lib/auth/hash.ts` (hashCode/verifyCode with timingSafeEqual) and `src/lib/auth/session.ts` (getSession/setSession/clearSession using HttpOnly signed cookie)
- feat(auth-gate) Task 2: Created `src/scripts/generate-access-code.ts` (one-shot CLI to insert hashed codes); `src/app/login/actions.ts` (verifyAccessCode server action with scrypt verification, expiry check, setSession on success); `src/app/login/page.tsx` + `src/app/login/login-form.tsx` (login UI using React 19 useActionState); 4 passing vitest tests
