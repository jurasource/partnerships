# Release Notes

## 2026-06-17
- feat(consortium-v2): required capability tags per role — each role slot has Nuclear/Infrastructure/Consultancy chip toggles; defaults pre-populated for civil nuclear roles; emitted into prompt as "Required capability tags: X, Y" so Claude can explicitly match firms to roles
- feat(consortium-v2): run modal stays open after streaming completes, showing results inline in a "Consortium suggestions" phase with a Done button — eliminates the jarring close+scroll-to-results transition
- feat(consortium-v2): stale results cleared on any form input change — suggestions, stream text, and parse error state all reset when opportunity/roles/firms/constraints change
- feat(consortium-v2): export buttons on result cards — "Copy markdown" formats all suggestions as clean markdown; "Export JSON" downloads consortium-suggestions.json
- feat(consortium-v2): collapsed result card header now shows "Firm · role" inline for each member — role visible without expanding
- feat(consortium-v2): tab descriptions added below tab list — one sentence per tab explaining Recommender vs AI Prompt Builder

## 2026-06-17 (role slots + anchor firm)
- feat(consortium): replace capability mix sliders with named role slots — each role has a title and free-text brief; pre-populated with three civil nuclear defaults (prime contractor, technical specialist, compliance & assurance); up to 8 roles, add/remove freely
- feat(consortium): add optional anchor firm selector — pin one firm as lead; LLM builds the rest of the consortium around them; automatically cleared if the firm is removed from scope
- feat(consortium): updated prompt assembly — ROLES and CONSORTIUM STRUCTURE sections; TASK wording updated to ask the LLM to map firms to roles and explain synergies

## 2026-06-17
- fix(consortium): resolve canonical names for partner/conflict firms outside the selected group (previously fell back to raw UUIDs in the generated prompt)
- feat(consortium): "Generate Prompt" now opens a modal with nicely rendered markdown; copy button copies raw markdown; "View Prompt" button reopens the modal
- feat(consortium): Step 3 "Firm scope" is now interactive — searchable checkbox list lets the user add/remove individual firms from the full database; syncs to group scope selector; "Select all" / "Clear" quick actions; capability tag badges for visual scanning

## 2026-06-16
- fix(research): move Anthropic prompt cache breakpoint to the system message array so `Output.object`'s `injectJsonInstructionIntoMessages` cannot displace it; expand `RESEARCH_SYSTEM_PROMPT` to ~1,141 tokens so the combined system prefix reliably clears the 1,024-token minimum for Sonnet 4.6
- feat(research): include topic `description` field in the per-topic user message so the LLM knows what specifically to look for per topic
- feat(research): store all raw Tavily search results in a new `search_results` column on `findings`; adds `npm run worker:dry-run` diagnostic script that captures and writes every Anthropic request and response to `dry-run-output/`
- feat(ui): source type badge ("AI Research" / "Verified API") moved inline with the section title; citation links now listed flat without badge prefix
- feat(ui): Sources sidebar restructured — grouped by topic section instead of source type; shows all Tavily results per topic with cited URLs in blue and uncited results dimmed; citation dates shown where available
- chore: commit generated Drizzle migration 0003 (ch_snapshots table — FK to firms, unique index on firm_id).
- fix(05): CR-001 — added guard in scorer to return no_valid_team when locked firms exceed team size, preventing silent over-sized team output.
- fix(05): CR-002 — fixed partnership weight normalisation; per-firm signals now normalise independently of the partnership bonus, eliminating ranking distortion at skewed weights.
- fix(05): WR-001 — replaced unguarded JSON.parse calls on capabilityTags with a safe helper (parseCapabilityTags) in scorer.ts and lock-firms.ts; malformed JSON returns [] instead of crashing.
- fix(05): WR-002 — renamed "Partnerships" column header in ScoreBreakdown table to "Capability" to match the capabilityMatch data it actually renders.
- fix(05): WR-003 — handleReset now clears result state as well as lockedFirmIds, so stale recommendations no longer persist after reset.
- fix(05): WR-004 — API route now validates all lockedFirmIds resolve to real DB rows, returning 422 with missing IDs if any are stale or non-existent.
- fix(05): WR-005 — replaced early-return guard in E9 integration test with describe.skipIf() so DB-unavailable runs show as skipped (yellow) rather than falsely green.
- Added /report page (server-rendered seeded 1+1+1 initial report, read-only) and the E9 seeded end-to-end test + golden snapshot proving the full pipeline.
- Added /recommend page (capability stepper, lock-firms + weight accordions, in-place result with lock-and-recompute and NSI/conflict/risk badges) and promoted Recommend + Report navbar links.

## 2026-06-15
- fix(analysis): selecting a group or capability on the analysis page caused a full UI freeze (no clicks registered until page refresh, no console errors) on production only; root cause was Base UI `<DropdownMenu>` defaulting to `modal:true`, which locks document scroll and disables outside pointer events while open — when a selection closed the menu and simultaneously triggered the heavy ConflictMatrix re-render, the scroll-lock RESTORE raced against the render in prod and lost, leaving the page stuck; fix is `modal={false}` on both filter dropdowns in `firms-filter-bar.tsx`
- feat: replaced single-step Add/Edit Firm dialog with a 2-step wizard; Step 1 is a Companies House search-first panel with explicit Search button, auto-selected first result, a preview panel (name/number/type/status/incorporated/address), ✓/✗ validation badge for direct 8-char CH number entry, and a "Showing X of Y" count message; Step 2 has the canonical name pre-filled from CH, aliases as removable chip tags (pre-seeded from registered name and previous company names), "Refresh from CH" button, "AI Suggest" button (Claude via Vercel AI SDK), and capability tag toggles; Edit Firm button added to firm profile page header; no DB migration required
- refactor: extracted CH data population (UK incorporated, country of ownership, etc.) from cross-cutting analysis into a dedicated `ch-refresh` BullMQ job; research now auto-enqueues both cross-cutting and ch-refresh jobs on completion; ch-refresh can also be triggered manually from the firm profile page ("Refresh CH Data" button, now queued with live status), the firms table (Building2 icon per row), and the jobs page batch submit ("CH Refresh" option); cross-cutting analysis drops from 5 to 4 steps
- fix: `extractOwnership` outer try-catch was silently swallowing DB errors (e.g. table-not-found) when writing to `ch_snapshots`, causing CH data to never appear on firm profiles even after running the cross-cutting job; DB errors now propagate and fail the job visibly; CH API fetch errors continue to be caught individually per-call
- feat: "Refresh CH Data" button added to every firm profile Companies House panel; calls a new `refreshCHData` server action that fetches profile/PSC/officers from CH API and upserts the snapshot inline (no queue) — provides a direct way to populate CH data without running a full analysis job
- test: added 4 snapshot write tests to `ownership.test.ts` covering: snapshot written with data, LLP empty-PSC regression (Baringa), no snapshot when all CH calls return null, no snapshot for firm with no CH number
- fix(CH panel): `CompaniesHousePanel` now correctly distinguishes three states: no CH number recorded, snapshot not yet fetched (has CH number but analysis not run), and data unavailable from CH API — previously a missing snapshot was silently displayed as "No Companies House number recorded."
- feat: CH data now cached in a new `ch_snapshots` table (profile, PSC, officers) during cross-cutting analysis — firm profile pages read from DB instead of calling the CH API live; CH registered name shown in the panel; `getOfficers` added to the ownership extraction fetch
- feat: Companies House data panel added to firm profile pages, displayed to the right of the Ownership panel; shows live-fetched company status, type, incorporation date, jurisdiction, registered address, persons with significant control, and top officers; fetched in parallel from the CH API on page load; gracefully handles missing CH numbers and API errors
- fix(ownership): `extractOwnership` now derives `ukIncorporated` from the Companies House company-profile `jurisdiction` field (the authoritative incorporation signal) rather than solely from the PSC register; firms with an empty PSC register — normal for LLPs such as Baringa Partners LLP (OC303471) — are now correctly marked UK-incorporated instead of falling through to the AI fallback and being recorded as `unknown`; PSC data continues to drive ownership/control fields (countryOfOwnership, pscNotTraceable, ultimateParent) while incorporation is now cleanly separated; added `UK_JURISDICTION_TERMS` / `isUkJurisdiction()` helper and an empty-PSC LLP branch, with new regression tests
- fix(ownership): `isUkCorporatePsc` now reads `identification.country_of_registration` (the correct CH API field for corporate PSCs) instead of `country_of_residence` (which is only populated for natural persons); `identification` field added to `PscItemSchema`; fixes UK LLPs and subsidiaries being incorrectly classified as foreign-owned or unknown
- feat: "Re-run Analysis" button added to firm profile header — enqueues a cross-cutting-only job without re-running AI research; shown only after a firm has been researched at least once
- feat: Jobs page gains a "Submit batch jobs" collapsible panel — select any combination of firms, choose "Research + Analysis" or "Analysis only", submit all in one action; ineligible firms (no CH number / not yet researched) are skipped with a reason shown
- refactor: shared `useFirmFilters` hook extracts filter state and filtering logic; `FirmWithGroups` type moved to `src/lib/types.ts`; `/analysis` page now uses the same filter bar as the firms table, filtering all three sections (ownership, conflicts, partnerships) simultaneously; `getAnalysisPageData` now returns firms with group memberships
- feat: added `db:generate`, `db:migrate`, and `db:studio` npm scripts (all load `.env.local` via `--env-file`); use `npm run db:migrate` as the Railway pre-deploy command instead of `db:push`

## 2026-06-15
- feat: unresolved JV partner names are now stored in a new `jv_leads` table instead of being discarded; re-extraction clears stale leads so the list self-heals once a firm is added and research is re-run; firm profile Collaboration History section now shows a "Potential JV Partners" amber-highlighted list with evidence context and an "Add Firm" button (pre-filled with the mentioned name) so users can track JV opportunities; `FirmFormDialog` gains `defaultName` and `onSuccess` props to support pre-filled adds


## 2026-06-15
- feat(04): added /analysis page with three sections — ownership nationality roll-up (total/UK/foreign/unknown stat tiles), firm × firm conflict matrix (CSS grid, flagged pairs highlighted red, firm name headers link to profiles), and partnership evidence table (TanStack Table, sortable, OCDS/AI Research source badges); sidebar Analysis nav entry now active; /jobs page shows "Research" vs "Cross-Cutting Analysis" type label per row (D-12); getAnalysisPageData() query introduced for RSC data fetching


## 2026-06-15
- fix(03.1): updateGroup now calls revalidatePath("/groups/${id}", "page") in addition to revalidatePath("/groups") so the detail page cache is invalidated after a rename, preventing stale-page scenarios in cached deployments (WR-04)
- fix(03.1): added UNIQUE constraint on groups.name (groups_name_unique index) to prevent duplicate group names at the DB level; createGroup and updateGroup now return a user-facing error "A group with that name already exists." on Postgres error code 23505 (WR-03)
- fix(03.1): GroupFormDialog now calls router.refresh() after a successful create so the groups list updates immediately without requiring navigation away and back (WR-01)
- fix(03.1): GroupRowActions now calls router.refresh() after a successful delete so the deleted row disappears immediately without requiring navigation away and back (WR-02)
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
- fix(analysis): move PartnershipTable columns to module scope and memoize rows — eliminates infinite render loop when toggling group filter on/off (TanStack Table detected new column/data references every render and queued re-renders in a loop)

## 2026-06-16
- fix(rate-limit): stagger batch job starts (90s between research jobs, 30s between analysis-only jobs) to prevent simultaneous LLM API calls from breaching the Anthropic 30k input-token-per-minute org rate limit
- feat(research): split buildTopicPrompt into buildGroundingBlock + buildTopicBlock; apply Anthropic cache_control to the grounding prefix in the research worker so the system prompt + structured firm data is cached across all 7 topic calls per firm (~47% fewer billable input tokens; cache hit/miss stats logged per call as "cache created=N read=N")
- Added /api/recommend POST route — deterministic rules-based consortium scorer (CONS-01..05); validates input with Zod, reads firm/conflict/ownership/partnership/risk/procurement tables read-only, returns ranked recommendations or explicit no_valid_team; Zod schemas (CapabilityMixSchema, ScoringWeightsSchema, RecommendRequestSchema, FirmScoreBreakdownSchema, TeamRecommendationSchema, RecommendResponseSchema) and pure-function scorer (buildConflictSet, hasConflict, scoreContractRelevance, scoreUkOwnership, scoreRiskFlags, scoreCapabilityMatch, scoreAndRankCombinations) with E1-E8 + locked Vitest eval suite (24 tests)

## 2026-06-17
- fix(tests): resolve TypeScript type errors across three test files — invalid `as const[]` syntax replaced with `as CapabilityTag[]` in firm-actions.test.ts; missing `searchResults` field added to four Finding fixtures in firm-profile.test.ts; invalid `Awaited<ReturnType<typeof import(...)>>` replaced with `(typeof import(...))` in seeded-e2e.test.ts
- feat(request-log): persist every Tavily search and LLM generateText call to a new `request_logs` table; add `/request-logs` page with tab filter (All / Tavily / LLM), sortable table showing firm, topic, token counts, cache hits, and duration, click-to-expand detail drawer with full prompt JSON and raw model response, per-row and bulk delete controls, and a "Logs" navbar link
- feat(request-logs): replace sidebar drawer with a wide modal (90vw); Tavily results render as cards with title/snippet/clickable URL; LLM responses parsed and displayed as structured FindingSchema cards (summary, confidence badge, primary source, citations); LLM prompts show role-labelled message blocks (system/user/assistant); all sections have per-section copy buttons and a footer "Copy raw JSON" button; fixes runtime error when system prompt was stored as an array of message objects
- feat(consortium): rename "Recommend" nav item and route to "Consortium" (/consortium); add firm group scoping (group selector above tabs restricts firm pool and pre-locks all group members); add "AI Prompt Builder" tab — a guided 4-step wizard (opportunity, requirements + constraints, firm scope confirmation, data selection) that assembles a structured LLM prompt from DB data and can run it against Claude inline, streaming the response and parsing it into scored consortium suggestion cards with a "View full response" option
