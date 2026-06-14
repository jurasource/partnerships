---
created: 2026-06-14T08:26:55.140Z
title: Fix Orano UK canonical name to "Orano Limited" in seed
area: database
files:
  - src/db/seed.ts
---

## Problem

The seed file uses "Orano UK" as the canonical name, but the firm appears to be registered in Companies House as "Orano Limited". Using the wrong canonical name will cause mismatches when searching Companies House by name and may return no results.

## Solution

In `src/db/seed.ts`, update the Orano entry:
- Change `canonicalName` from `"Orano UK"` to `"Orano Limited"`
- Add `"Orano UK"` to the `aliases` array so searches by the common trading name still work
- Also confirm and add the Companies House number for Orano Limited (currently `null` with TODO) if it can be found in the CH register

Re-run `npm run db:seed` after the change (or wipe and re-seed) so the live DB reflects the correction.
