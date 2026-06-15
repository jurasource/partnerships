# Release Notes

## 2026-06-15
- docs(plan): created quick-task plan 260615-dn8 for multi-source citations — extends FindingSchema with citations array, adds citations column to findings table, filters citation URLs through E4 gate, renders supporting sources in citation panel
- Added mandatory commit and release workflow rules to CLAUDE.md: run tests before committing, update PENDING_RELEASE.md and RELEASE_NOTES.md after each commit, and always branch/PR rather than pushing directly to main
- feat(auth-gate) Task 1: Installed iron-session@8.0.4; added `access_codes` table to schema (scrypt-hashed code store with active/expiry fields); created `src/lib/auth/hash.ts` (hashCode/verifyCode with timingSafeEqual) and `src/lib/auth/session.ts` (getSession/setSession/clearSession using HttpOnly signed cookie)
- feat(auth-gate) Task 2: Created `src/scripts/generate-access-code.ts` (one-shot CLI to insert hashed codes); `src/app/login/actions.ts` (verifyAccessCode server action with scrypt verification, expiry check, setSession on success); `src/app/login/page.tsx` + `src/app/login/login-form.tsx` (login UI using React 19 useActionState); 4 passing vitest tests
- feat(auth-gate) Task 3: Created `src/lib/auth/constants.ts` (shared SESSION_OPTIONS to prevent drift); `src/middleware.ts` guards all routes except /login, /_next, and static assets; session verified on every request via iron-session; all 98 tests pass

- fix: wrap generate-access-code.ts top-level await in async IIFE — CJS output format does not support top-level await

- feat: add logout button to sidebar footer — clears iron-session cookie and redirects to /login

## 2026-06-15
- feat(ui-redesign-analytics): replaced sidebar navigation with a fixed dark charcoal top navbar; site renamed to "Partnerships"; background shifted to warm grey; capability pills recoloured (rose/cyan/indigo); research status badges recoloured (slate/orange/emerald); login page renders with no navbar (blank, clean); Umami analytics component added via inline component — silently disabled in dev when NEXT_PUBLIC_UMAMI_WEBSITE_ID is unset
- feat(ui-icons): added icons8-network icon to navbar (20×20, left of "Partnerships" wordmark); replaced generic favicon.ico with icons8-network-16.png
