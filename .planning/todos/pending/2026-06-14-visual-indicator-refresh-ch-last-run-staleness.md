---
created: 2026-06-14T17:03:58.403Z
title: Visual indicator for Refresh CH last run time and staleness
area: ui
files:
  - src/components/firms/firms-table.tsx
  - src/components/dashboard/comparison-table.tsx
  - src/db/schema.ts
---

## Problem

Users have no visibility into when the Companies House data for a firm was last refreshed or how stale it is. Unlike AI research (which has a staleness badge), the CH structured-data refresh has no corresponding freshness indicator. Users cannot tell at a glance whether the CH data is hours or months old.

## Solution

1. Ensure `firms.chLastRefreshedAt` (or similar) timestamp is stored in the DB on each successful CH data pull.
2. Display a staleness badge or "last refreshed X ago" label in the firms table and comparison table rows (similar to the existing `StalenessBadge` for AI research).
3. Consider a colour-coded threshold (e.g. green < 7 days, amber < 30 days, red > 30 days).
