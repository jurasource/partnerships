---
created: 2026-06-14T17:03:58.403Z
title: Firm name tooltip showing full popup detail on hover
area: ui
files:
  - src/components/dashboard/comparison-table.tsx
  - src/components/firms/firms-table.tsx
---

## Problem

To see a firm's full detail the user must open a modal/dialog. On the dashboard and firm list, hovering over the company name shows nothing. Quick access to that detail without a full navigation would speed up the scan-and-compare workflow.

## Solution

Add a shadcn `Tooltip` (or `HoverCard`) on every firm name in the comparison table, firms table, and any other listing. The tooltip/hover-card content should mirror the fields shown in the firm detail modal: canonical name, CH number, capability tags, ownership, last researched, contract count, etc. The modal remains for editing; the tooltip is read-only.
