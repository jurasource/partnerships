---
created: 2026-06-14T09:32:36.002Z
title: View firm refresh results after data pull
area: ui
files:
  - src/components/firms/firm-row-refresh.tsx
  - src/lib/actions/refresh-actions.ts
  - src/db/schema.ts (procurementRecords table)
---

## Problem

After clicking refresh on a firm and waiting for the spinner + "Procurement data refreshed" toast, there is no way to see what was actually fetched. The procurement records are written to the SQLite database (procurementRecords table) but there is no UI that surfaces them. The user has no way to verify the refresh worked, inspect what contracts were found, or act on the data.

## Solution

Add a per-firm detail view (drawer, modal, or dedicated page) that shows:
- Procurement records fetched from Contracts Finder and Find a Tender (title, notice date, value, contracting authority, source)
- Companies House profile snapshot (SIC codes, status, incorporation date)
- PSC / ownership structure
- Link to view raw OCDS JSON for auditability

This view should be accessible from the Firms table row — either via a row click, an expand chevron, or a "View results" link that appears after a successful refresh. The toast on refresh completion could also include a "View" action button that opens the detail directly.

Consider whether this is a drawer (keeps context of the list) vs a dedicated /firms/[id] route (more room for data).
