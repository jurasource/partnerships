---
phase: 04-cross-cutting-analysis
plan: "01"
subsystem: cross-cutting-schema
tags: [schema, drizzle, cross-cutting, ownership, risk-flags, extraction, unit-tests]
dependency_graph:
  requires: [03-dashboard-profiles]
  provides: [ownership_records, risk_flags, collaboration_records, conflict_pairs, partnership_pairs, jobs.jobType, extractOwnership, extractRiskFlags]
  affects: [04-02, 04-03, 04-04]
tech_stack:
  added: []
  patterns: [drizzle-delete-then-insert-transaction, onConflictDoUpdate-upsert, generateText-Output.object, vi.hoisted-mock-pattern, topic-lookup-two-step]
key_files:
  created:
    - src/lib/cross-cutting/schemas.ts
    - src/lib/cross-cutting/topic-lookup.ts
    - src/lib/cross-cutting/ownership.ts
    - src/lib/cross-cutting/risk-flags.ts
    - src/lib/cross-cutting/__tests__/ownership.test.ts
    - src/lib/cross-cutting/__tests__/risk-flags.test.ts
    - drizzle/0000_phase4_cross_cutting.sql
  modified:
    - src/db/schema.ts
    - src/lib/types.ts
decisions:
  - "[04-01] drizzle-kit push is non-interactive in Claude Code env; applied schema via direct psql DDL with IF NOT EXISTS guards — equivalent to push but with no TTY dependency"
  - "[04-01] RiskFlagsExtraction skips findings with sourceUrl=not-found sentinel — prevents LLM call on absent data, consistent with Phase 2 empty-state pattern"
  - "[04-01] flagType forced per topic category in extractRiskFlags, not trusted from LLM output (T-04-01 prompt injection mitigation)"
  - "[04-01] topic-lookup uses two-step parameterised query (topic by name, then finding by firmId+topicId) — avoids join complexity and stays within Drizzle typed API"
metrics:
  duration: "12 min"
  completed: "2026-06-15"
  tasks_completed: 3
  files_modified: 9
  tests_added: 14
---

# Phase 04 Plan 01: Cross-Cutting Schema + Ownership/Risk Extraction Summary

**One-liner:** Five Drizzle pgTable definitions for cross-cutting records, jobs.jobType column, Zod extraction schemas, two-step topic-lookup helper, and two LLM extraction functions (extractOwnership + extractRiskFlags) with delete-then-insert transaction safety and 14 passing unit tests.

## What Was Built

### Task 1: Schema Extension + Zod Schemas + Topic-Lookup
- **src/db/schema.ts**: Added 5 pgTable definitions (`ownershipRecords`, `riskFlags`, `collaborationRecords`, `conflictPairs`, `partnershipPairs`) with FK references, appropriate uniqueIndexes, and typed enum columns. Added `jobType` column to `jobs` table (NOT NULL DEFAULT 'research').
- **src/lib/types.ts**: Exported 5 new `InferSelectModel` row types (`OwnershipRecord`, `RiskFlag`, `CollaborationRecord`, `ConflictPair`, `PartnershipPair`).
- **src/lib/cross-cutting/schemas.ts**: `OwnershipExtractionSchema`, `RiskFlagExtractionSchema`, and `RiskFlagsExtractionSchema` (flags array wrapper). All fields have `.describe()` text guiding LLM extraction. No `"server-only"` import.
- **src/lib/cross-cutting/topic-lookup.ts**: `TOPIC_NAMES` const with 5 exact seeded topic name strings. `findFindingByTopicName(firmId, topicName)` performs two-step parameterised Drizzle lookup (topic by name, then finding by firmId + topicId). No `"server-only"` import.

### Task 2: extractOwnership + extractRiskFlags with Unit Tests
- **src/lib/cross-cutting/ownership.ts**: `extractOwnership(firmId)` with data priority: (1) CH PSC data — derives ukIncorporated/countryOfOwnership/pscNotTraceable using UK_NATURAL_PERSON_TERMS and UK_COUNTRY_TERMS classification from grounding.ts; (2) "Ownership structure" AI finding fallback; (3) explicit "unknown" record for no-data case. Always upserts exactly one row via onConflictDoUpdate. Never throws on missing data.
- **src/lib/cross-cutting/risk-flags.ts**: `extractRiskFlags(firmId)` reads 3 risk topic findings, skips not-found sentinels, calls generateText + Output.object per finding, forces flagType per topic category (never trusts LLM), catches NoObjectGeneratedError per topic without aborting others. Atomically deletes all prior flags then inserts fresh ones in a `db.transaction`.
- **ownership.test.ts** (6 tests): UK-firm writes ukIncorporated='yes'/sourceType='companies_house', foreign PSC writes pscNotTraceable='yes'/ukIncorporated='no', no-CH-no-finding writes ukIncorporated='unknown'/sourceType='ai_research', AI fallback uses finding's sourceUrl, all use onConflictDoUpdate.
- **risk-flags.test.ts** (8 tests): skip not-found sentinel, all 3 topics called for real findings, delete-then-insert ordering, forced flagType per topic, stale flag removal on re-run, NoObjectGeneratedError isolation, severity and sourceDate persistence.

### Task 3: Schema Pushed to Postgres
All 5 new tables and `jobs.job_type` column applied to the running Postgres instance via direct psql DDL with `IF NOT EXISTS` guards (drizzle-kit push requires TTY). Drizzle migration snapshot generated at `drizzle/0000_phase4_cross_cutting.sql` for reference. All schema objects confirmed via `information_schema` query.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed double `.where()` chain in topic-lookup.ts**
- **Found during:** Task 1 TypeScript check
- **Issue:** Drizzle's select builder returns `Omit<PgSelectBase, 'where'>` after first `.where()` call — chaining two `.where()` calls causes TS error TS2339
- **Fix:** Changed to `and(eq(findings.firmId, firmId), eq(findings.topicId, topic.id))` in a single `.where()` call
- **Files modified:** src/lib/cross-cutting/topic-lookup.ts
- **Commit:** 6e53bfc

**2. [Rule 3 - Blocking] drizzle-kit push non-interactive in Claude Code environment**
- **Found during:** Task 3
- **Issue:** `drizzle-kit push` requires TTY for interactive table-resolver prompts (new tables look like potential renames of existing ones). `--force` flag only skips data-loss prompts, not the table-resolver disambiguation prompt.
- **Fix:** Applied equivalent DDL directly via `docker exec psql` with `IF NOT EXISTS` guards and `DO $$ IF NOT EXISTS $$` blocks for constraints. Generated Drizzle migration snapshot via `drizzle-kit generate` for future reference and reproducibility.
- **Files modified:** drizzle/0000_phase4_cross_cutting.sql (generated), drizzle/meta/ (generated)
- **Commit:** d37a675

**3. [Rule 2 - Missing critical functionality] Test expectation for not-found sentinel skip**
- **Found during:** Task 2 initial test run (12/13 passing)
- **Issue:** Test expected `generateText` to be called 3 times even when one finding was a not-found sentinel (`sourceUrl='not-found'`). Implementation correctly skips sentinels (T-04-03 — prevents LLM calls on fabricated/absent data). Test expectation was wrong, not the implementation.
- **Fix:** Corrected test to assert that sentinels are skipped (2 LLM calls, not 3) and added a second test asserting 3 calls when all 3 topics have real findings.
- **Files modified:** src/lib/cross-cutting/__tests__/risk-flags.test.ts
- **Commit:** a0b9b1e

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-04-01 | flagType forced per topic in extractRiskFlags — model output for this field is discarded and overwritten with the known category |
| T-04-02 | delete-then-insert in db.transaction in extractRiskFlags — no stale flag accumulation on re-run |
| T-04-03 | not-found sentinels (sourceUrl='not-found') skipped before LLM call — no LLM extraction on absent data; Zod schema requires non-empty sourceUrl/rawSnippet |

## Known Stubs

None. All implementation writes real DB rows. No placeholder data flows to UI rendering.

## Threat Flags

None. No new network endpoints introduced. All new surface is internal DB writes via Drizzle (parameterised queries). Cross-cutting/ files do not expose any new trust boundaries beyond those in the plan's threat model.

## Self-Check: PASSED
