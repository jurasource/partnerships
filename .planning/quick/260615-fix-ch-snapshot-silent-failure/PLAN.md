---
slug: fix-ch-snapshot-silent-failure
date: 2026-06-15
status: in-progress
---

# Fix CH Snapshot Silent Failure + Add Refresh CH Feature

## Goal
CH snapshots are not being written because the outer try-catch in `extractOwnership` silently swallows DB errors (table-not-found etc.). Add a dedicated Refresh CH button and add snapshot write tests.

## Tasks

- [ ] 1. Fix ownership.ts: remove outer try-catch so DB errors propagate; keep individual `.catch(() => null)` on CH API fetches
- [ ] 2. Extract `refreshCHSnapshot(firmId)` as a standalone exported function in ownership.ts
- [ ] 3. Add `refreshCHData` server action in research-actions.ts
- [ ] 4. Create firm-ch-refresh.tsx button component
- [ ] 5. Wire button into firm-profile-page.tsx (inside CompaniesHousePanel section)
- [ ] 6. Add snapshot write tests to ownership.test.ts
- [ ] 7. Run tests, update PENDING_RELEASE.md + RELEASE_NOTES.md, commit
