---
slug: fix-partnership-table-infinite-render
date: "2026-06-16"
status: in-progress
---

# Fix: PartnershipTable infinite render loop

## Problem
`PartnershipTable` freezes the analysis page when toggling a group filter on/off.
Chrome debugger confirms: execution is stuck in a render loop inside `TableHead`.

Root cause: `columns` (ColumnDef array) and `rows` are defined as plain variables
inside the component body. TanStack Table v8 calls `table.setOptions()` on every render;
when it receives new object references for `columns` or `data`, it queues an internal
re-render via its reducer → new references created again → infinite loop.

## Fix

### Task 1: Move `columns` outside the component
`columns` cells access data exclusively via `row.original` / `row.getValue()` at
call time — no closure over component props or state. Safe to define at module level.

### Task 2: Memoize `rows` with useMemo
`rows` depends on `partnershipPairs` and `allFirms`. Move `firmNameMap` construction
into the same `useMemo` to keep it co-located.

## Files
- `src/components/analysis/partnership-table.tsx`
