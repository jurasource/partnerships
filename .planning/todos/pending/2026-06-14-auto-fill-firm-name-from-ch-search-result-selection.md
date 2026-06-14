---
created: 2026-06-14T11:38:44.306Z
title: Auto-fill firm name from CH search result selection
area: ui
files:
  - src/components/firms/ch-search-field.tsx
  - src/components/firms/firm-form-dialog.tsx
---

## Problem

In the Add Firm dialog, when a user searches Companies House by name and selects a result, the CH number field auto-fills — but the firm name field does not. If the user hasn't typed anything in the name field yet, they have to manually type the company name after selecting from search results, which is redundant.

## Solution

When the user selects a result from the CH search dropdown:
- If the firm name field is empty (no value yet), auto-fill it with the selected company's name from the CH search result (`companyName` or equivalent field on the result object).
- If the firm name field already has a value (user typed something first), leave it unchanged.

This likely requires `ChSearchField` to accept an `onNameSelect` callback prop (similar to how it already calls back to fill the CH number), and `FirmFormDialog` to wire that callback to the name field's form state.
