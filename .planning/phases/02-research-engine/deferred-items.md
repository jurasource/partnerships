# Deferred Items — Phase 02: Research Engine

## Pre-existing Out-of-Scope Issues

### TS2304 in firm-actions.test.ts (5 errors)

**File:** `src/lib/actions/firm-actions.test.ts` (lines 48, 75, 108, 141, 175)
**Error:** `TS2304: Cannot find name 'const'` — caused by invalid `as const[]` syntax
**Status:** Pre-existed before Phase 02 Plan 01 (confirmed via `git stash` check against HEAD of phase 01)
**Impact:** `npx tsc --noEmit` exits non-zero but only due to these 5 pre-existing errors; all Phase 02 new files type-check cleanly
**Resolution:** Fix `as const[]` to `as const satisfies string[]` or remove the cast — straightforward syntax fix
**Deferred from:** Phase 02 Plan 01 (02-01)
**Deferred at:** 2026-06-14
