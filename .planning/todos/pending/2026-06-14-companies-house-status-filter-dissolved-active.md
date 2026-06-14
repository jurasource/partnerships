---
created: 2026-06-14T13:50:13.960Z
title: Companies House status filter (dissolved, active, etc.)
area: ui
files: []
---

## Problem

When Companies House search results are displayed (e.g. in the firm add/edit dialog or any CH lookup panel), all company statuses are shown together — active, dissolved, liquidation, etc. Users working on bid/consortium planning only care about active firms, but dissolved entities clutter the results and can cause confusion if selected.

## Solution

Add a status filter control to the Companies House results display. Filter options should map to the `company_status` field returned by the CH API: `active`, `dissolved`, `liquidation`, `administration`, `voluntary-arrangement`, `converted-closed`, `insolvency-proceedings`, `registered`, `removed`. Default to showing all, with a quick-select for "Active only". The filter should be client-side (results already fetched) to avoid extra API calls.
