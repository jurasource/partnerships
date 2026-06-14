---
created: 2026-06-14T17:03:58.403Z
title: Default sort by firm name ascending on firms and dashboard pages
area: ui
files:
  - src/components/dashboard/comparison-table.tsx
  - src/components/firms/firms-table.tsx
---

## Problem

The firms table and the comparison dashboard table have no explicit default sort, so row order is determined by DB insertion order. This makes scanning the list unpredictable, especially as the firm count grows.

## Solution

Set `initialState: { sorting: [{ id: "name", desc: false }] }` (or equivalent column ID) in the `useReactTable` config for both the comparison table and the firms table. Firm name A→Z is the expected default; the user can still click column headers to change sort.
