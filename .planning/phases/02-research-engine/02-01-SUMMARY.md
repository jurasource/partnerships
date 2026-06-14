---
phase: 02-research-engine
plan: 01
subsystem: ai
tags: [vercel-ai-sdk, anthropic, tavily, zod, sqlite, drizzle, research-engine, web-search]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: firms table (with companiesHouseNumber), topics table (7 seed topics), procurementRecords table, findings table, jobs table, CH/OCDS API clients, rateLimitedFetch
provides:
  - WebSearchClient interface + WebSearchResult/WebSearchQuery types (src/lib/search/types.ts)
  - Tavily implementation of WebSearchClient (src/lib/search/tavily.ts)
  - FindingSchema (Zod, confidence HIGH|MEDIUM only, .min(1) citation fields) + NOT_FOUND_SENTINEL (src/lib/research/schemas.ts)
  - buildGroundingContext — CH + OCDS context block builder (src/lib/research/grounding.ts)
  - RESEARCH_SYSTEM_PROMPT + buildTopicPrompt + buildSearchQuery (src/lib/research/prompts.ts)
  - runResearchWorker — per-firm sequential topic synthesis loop (src/lib/research/worker.ts)
  - lastResearchedAt column on firms table (DB-live via db:push)
  - ai@^6 + @ai-sdk/anthropic@^3 installed
affects:
  - 02-02 (Wave 2 — route handler that fires runResearchWorker)
  - 02-03 (Wave 3 — dashboard UI consumes lastResearchedAt and findings table)

# Tech tracking
tech-stack:
  added:
    - ai@^6.0.205 (Vercel AI SDK v6 — generateText + Output.object pattern)
    - "@ai-sdk/anthropic@^3.0.84 (Anthropic provider for AI SDK)"
  patterns:
    - WebSearchClient interface for provider-agnostic search (dependency-injected in worker for testability)
    - FindingSchema .min(1) Zod fields enforce citation invariant at type-system level
    - NOT_FOUND_SENTINEL as explicit absence record (never zero rows per topic)
    - Sequential for loop over topics (no Promise.all) — rate-limit and partial-failure design
    - Citation-origin gate (E4): MEDIUM findings whose sourceUrl is not in Tavily result URLs are coerced to sentinel
    - server-only import guard on all server-side AI/search/grounding modules
    - vi.mock('ai') + stub WebSearchClient pattern for testing without live API keys

key-files:
  created:
    - src/lib/search/types.ts
    - src/lib/search/tavily.ts
    - src/lib/research/schemas.ts
    - src/lib/research/grounding.ts
    - src/lib/research/prompts.ts
    - src/lib/research/worker.ts
    - src/lib/research/worker.test.ts
  modified:
    - src/db/schema.ts (lastResearchedAt column added to firms table)
    - package.json + package-lock.json (ai + @ai-sdk/anthropic)
    - src/lib/adapters/ocds.test.ts (added lastResearchedAt: null to Firm fixture)
    - src/lib/clients/contracts-finder.test.ts (added lastResearchedAt: null to Firm fixture)
    - src/lib/clients/find-a-tender.test.ts (added lastResearchedAt: null to Firm fixture)

key-decisions:
  - "ai@6 installed (spec said ai@5 but latest stable is v6; generateText + Output.object API is identical)"
  - "NoObjectGeneratedError (not AI_NoObjectGeneratedError) — v6 renames the export; worker uses the correct v6 name"
  - "WebSearchClient.search(query: string, maxResults?: number) — flat signature per plan spec (not WebSearchQuery object)"
  - "Topics read from DB (db.select().from(topics)) — not a hardcoded RESEARCH_TOPICS array (per seed.ts)"
  - "Citation-origin gate (E4) applied at MEDIUM confidence only — HIGH findings are structured-API facts, not web-search derived"

patterns-established:
  - "server-only import on all AI/search/grounding modules — keys never reach client components (T-02-01)"
  - "NOT_FOUND_SENTINEL pattern — topicId + reason in rawSnippet for diagnostic context"
  - "vi.mock('ai') with module-level mock function + vi.clearAllMocks() in beforeEach for isolated test control"
  - "dbSelectCallIndex counter for multi-call db.select() mock sequencing (firm lookup vs topics query)"

requirements-completed: [RES-03, RES-04, RES-05, RES-06]

# Metrics
duration: 15min
completed: 2026-06-14
---

# Phase 02 Plan 01: Research Engine Core Summary

**Citation-grounded research synthesis engine: Tavily WebSearchClient, Zod FindingSchema enforcing citation invariant, NOT_FOUND_SENTINEL for explicit absence, and sequential per-firm runResearchWorker that writes one validated finding per topic via Vercel AI SDK generateText + Output.object**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-14T13:43:00Z
- **Completed:** 2026-06-14T13:53:05Z
- **Tasks:** 3 (Task 1 auto-approved checkpoint, Task 2 install+schema, Task 3 TDD implementation)
- **Files modified:** 11

## Accomplishments

- Installed `ai@^6` and `@ai-sdk/anthropic@^3` (Vercel AI SDK v6 + Anthropic provider); `lastResearchedAt` column live in SQLite
- WebSearchClient interface + Tavily implementation: server-only, TAVILY_API_KEY env guard, POST to https://api.tavily.com/search via rateLimitedFetch, Zod-validated response
- FindingSchema (confidence enum `['HIGH','MEDIUM']` — LOW excluded by type), NOT_FOUND_SENTINEL, buildGroundingContext, RESEARCH_SYSTEM_PROMPT + prompt builders, and runResearchWorker with E1/E2/E4 guardrails
- 7 vitest tests GREEN: E1 citation completeness, E2 explicit absence (NoObjectGeneratedError → sentinel), no-LOW x3 (FindingSchema rejects LOW), NOT_FOUND_SENTINEL shape, topic coverage (COUNT(DISTINCT topicId) = N topics)

## Task Commits

1. **Task 1: Package legitimacy gate** — auto-approved checkpoint (auto_mode=true) — no commit
2. **Task 2: Install AI SDK + Tavily client + lastResearchedAt** — `be3ad08` (feat)
3. **Task 3 RED: Failing invariant tests** — `8c2401a` (test)
4. **Task 3 GREEN: Research engine implementation** — `bf7dff9` (feat)

## Files Created/Modified

- `src/lib/search/types.ts` — WebSearchQuery, WebSearchResult, WebSearchClient interface (pure types, no server-only)
- `src/lib/search/tavily.ts` — TavilySearchClient implementing WebSearchClient; server-only, env guard, rateLimitedFetch
- `src/lib/research/schemas.ts` — FindingSchema (Zod, HIGH|MEDIUM only), SynthesisedFinding type, NOT_FOUND_SENTINEL function
- `src/lib/research/grounding.ts` — buildGroundingContext (CH + top-10 OCDS by noticeDate DESC), formatGroundingContext; server-only
- `src/lib/research/prompts.ts` — RESEARCH_SYSTEM_PROMPT, buildSearchQuery, buildTopicPrompt (includes CH number for E6), formatSearchResults
- `src/lib/research/worker.ts` — runResearchWorker: sequential for loop, reads topics from DB, E4 citation-origin gate, NOT_FOUND_SENTINEL on NoObjectGeneratedError; server-only
- `src/lib/research/worker.test.ts` — 7 invariant tests running without live API keys
- `src/db/schema.ts` — added `lastResearchedAt: text("last_researched_at")` to firms table (nullable, no default)
- `src/lib/adapters/ocds.test.ts`, `contracts-finder.test.ts`, `find-a-tender.test.ts` — added `lastResearchedAt: null` to Firm fixtures (Rule 1 fix)

## Decisions Made

- **ai@6 vs ai@5:** Spec said ai@5.x but npm latest stable is v6. `generateText` + `Output.object({ schema })` API is identical in v5 and v6 per migration guide — v6 installed.
- **NoObjectGeneratedError name:** v6 exports `NoObjectGeneratedError` (not `AI_NoObjectGeneratedError` as the spec's v5 examples show). Worker and test use the v6 name.
- **WebSearchClient interface signature:** `search(query: string, maxResults?: number)` — flat string query per plan spec (not a WebSearchQuery object wrapper).
- **Topics from DB:** Worker reads topics via `db.select().from(topics)` — no hardcoded array (seed.ts owns the source of truth).
- **E4 gate scope:** Citation-origin check applies to MEDIUM confidence only; HIGH findings are structured-API facts whose sourceUrl is a registry identifier (e.g. "companies-house"), not a Tavily URL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 test fixture type errors from lastResearchedAt schema addition**
- **Found during:** Task 2 (schema change)
- **Issue:** Adding `lastResearchedAt` to the firms table made Drizzle's `InferSelectModel<typeof firms>` require the new field; existing test fixtures in ocds.test.ts, contracts-finder.test.ts, find-a-tender.test.ts used inline `Firm` objects without the field
- **Fix:** Added `lastResearchedAt: null` to the three affected test fixtures
- **Files modified:** src/lib/adapters/ocds.test.ts, src/lib/clients/contracts-finder.test.ts, src/lib/clients/find-a-tender.test.ts
- **Verification:** `npx tsc --noEmit` — 0 new errors from our files
- **Committed in:** be3ad08 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed NoObjectGeneratedError constructor args for ai SDK v6**
- **Found during:** Task 3 (TDD RED/GREEN)
- **Issue:** Spec example showed `promptTokens`/`completionTokens` in usage; ai@6 uses `inputTokens`/`outputTokens`/`totalTokens`; also `body` removed from `LanguageModelResponseMetadata`
- **Fix:** Updated test constructor args with `as any` cast for usage type (internal test usage only; production code is not affected)
- **Files modified:** src/lib/research/worker.test.ts
- **Verification:** All 7 tests GREEN; `npx tsc --noEmit` — 0 new errors
- **Committed in:** bf7dff9 (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs — both triggered by version differences between spec (ai@5) and latest stable (ai@6))
**Impact on plan:** Both auto-fixes necessary for type-correctness and test functionality. No scope changes.

**Pre-existing deferred issue (out of scope):**
- `src/lib/actions/firm-actions.test.ts` has 5 TS errors (`as const[]` invalid syntax) — pre-dated this plan, confirmed by `git stash` check. Logged to deferred-items.md.

## Issues Encountered

- Vitest `vi.mock` factory closure required a module-level `dbSelectCallIndex` counter to sequence multiple `db.select()` calls (firm lookup vs topics query) — `require()` inside beforeEach fails in vitest's module system. Solved with module-level state + `vi.clearAllMocks()` reset.

## User Setup Required

**External services require API keys before runResearchWorker can call live APIs:**

- `TAVILY_API_KEY` — get at [Tavily Dashboard → API Keys](https://app.tavily.com/) (free tier ~1000 searches/month). Add to `.env.local`.
- `ANTHROPIC_API_KEY` — get at [Anthropic Console → API Keys](https://console.anthropic.com/). Add to `.env.local`.

The worker runs without these keys in test mode (all AI/search calls are mocked). Keys are only required for live research runs triggered by Wave 2 route handler.

## Next Phase Readiness

- `runResearchWorker(firmId, jobId, searchClient)` is ready for Wave 2 to wire into a Next.js API route handler
- `lastResearchedAt` column exists for Wave 2/3 staleness display
- `findings` table schema unchanged — Wave 3 dashboard reads it directly
- Pre-existing `firm-actions.test.ts` TSC errors should be resolved before next TSC-gated task to avoid confusion

## Known Stubs

None — no stub data flows to UI rendering. The worker writes real findings (or explicit sentinels) to the DB; Wave 3 reads from the DB.

---
*Phase: 02-research-engine*
*Completed: 2026-06-14*
