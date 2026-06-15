# Release Notes

## 2026-06-15
- feat(03.1-03): firms table now shows a Groups column of clickable amber pill badges (linking to /groups/[id]) after Capabilities; added FirmsFilterBar above the table with Groups multi-select (OR logic), Capabilities multi-select (OR logic), and Research status single-select (All / Researched / Not researched / Stale >30 days); in-memory filtering narrows rows before TanStack; Clear filters button shown when any filter active

## 2026-06-15
- feat(03.1-02): Groups management area — added "Groups" nav item (Layers icon, between Firms and Topics); `/groups` list page with firm counts, create-group dialog, and delete; `/groups/[id]` detail page with inline rename, add-firm select, and remove-firm buttons; all mutations route through Plan 01 server actions

## 2026-06-15
- feat(03.1-01): added `groups` and `firm_groups` tables to Drizzle schema with composite PK and cascade FK; exported `Group`/`FirmGroup` inferred types; created five group server actions (`createGroup`, `updateGroup`, `deleteGroup`, `addFirmToGroup`, `removeFirmFromGroup`) following the `{ ok, error? }` contract; 19 unit tests green

## 2026-06-15
- fix(redis): `getRedisConnection()` now parses `REDIS_URL` (with password extraction) when set, falling back to `REDIS_HOST`/`REDIS_PORT` — simplifies Railway deployment where the Redis addon provides a single connection URL
- fix(research-worker): catch NoOutputGeneratedError alongside NoObjectGeneratedError — the AI SDK throws this from the result.output getter when the model produces no output at all, which previously re-threw and failed the whole job instead of writing a sentinel
- fix(research-logging): worker now logs firm+topic count at start, search result count + generateText call per topic, finding outcome per topic, and full error type+stack before re-throw; runner logs full stack on job failure
- fix(jobs-page): firm name now links to firm detail page; failed jobs always show error message in a "Details" column (previously the column was hidden for completed jobs)
- feat(multi-source-citations) Task 3: Citation panel now renders an "Also sourced from:" sub-list of supporting Tavily sources beneath the primary URL for AI-research findings; primary URL de-duplicated from the list; structured findings always show no sub-list
- feat(multi-source-citations) Task 2: Extended system prompt with citations output rule; worker now filters supporting citations through E4 origin gate and persists them as JSON on insert and conflict-update
- feat(multi-source-citations) Task 1: Added CitationSchema and citations array field to FindingSchema; added citations text column (JSON) to findings table with NOT NULL default "[]"; updated firm-profile test fixtures to include citations field
- docs(plan): created quick-task plan 260615-dn8 for multi-source citations — extends FindingSchema with citations array, adds citations column to findings table, filters citation URLs through E4 gate, renders supporting sources in citation panel
- Added mandatory commit and release workflow rules to CLAUDE.md: run tests before committing, update PENDING_RELEASE.md and RELEASE_NOTES.md after each commit, and always branch/PR rather than pushing directly to main
- feat(auth-gate) Task 1: Installed iron-session@8.0.4; added `access_codes` table to schema (scrypt-hashed code store with active/expiry fields); created `src/lib/auth/hash.ts` (hashCode/verifyCode with timingSafeEqual) and `src/lib/auth/session.ts` (getSession/setSession/clearSession using HttpOnly signed cookie)
- feat(auth-gate) Task 2: Created `src/scripts/generate-access-code.ts` (one-shot CLI to insert hashed codes); `src/app/login/actions.ts` (verifyAccessCode server action with scrypt verification, expiry check, setSession on success); `src/app/login/page.tsx` + `src/app/login/login-form.tsx` (login UI using React 19 useActionState); 4 passing vitest tests
- feat(auth-gate) Task 3: Created `src/lib/auth/constants.ts` (shared SESSION_OPTIONS to prevent drift); `src/middleware.ts` guards all routes except /login, /_next, and static assets; session verified on every request via iron-session; all 98 tests pass

- fix: wrap generate-access-code.ts top-level await in async IIFE — CJS output format does not support top-level await

- feat: add logout button to sidebar footer — clears iron-session cookie and redirects to /login

## 2026-06-15
- fix(research-token-limit): raised default `maxOutputTokens` from 1024 → 2048; added retry at 4096 tokens when `finishReason=length` to prevent truncated JSON from silently producing a sentinel; split `RESEARCH_ERROR_SENTINEL` (`sourceUrl="research-error"`) from `NOT_FOUND_SENTINEL` (`sourceUrl="not-found"`) so technical failures show a distinct user-facing error message rather than "Nothing found for this topic"

## 2026-06-15
- feat(ui-redesign-analytics): replaced sidebar navigation with a fixed dark charcoal top navbar; site renamed to "Partnerships"; background shifted to warm grey; capability pills recoloured (rose/cyan/indigo); research status badges recoloured (slate/orange/emerald); login page renders with no navbar (blank, clean); Umami analytics component added via inline component — silently disabled in dev when NEXT_PUBLIC_UMAMI_WEBSITE_ID is unset
- feat(ui-icons): added icons8-network icon to navbar (20×20, left of "Partnerships" wordmark); replaced generic favicon.ico with icons8-network-16.png
