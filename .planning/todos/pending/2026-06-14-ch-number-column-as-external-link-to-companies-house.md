---
created: 2026-06-14T18:10:08.269Z
title: CH number column as external link to Companies House
area: ui
files:
  - src/components/firms/firms-table.tsx
  - src/components/firms/firm-profile-page.tsx
---

## Problem

The Companies House number is displayed as plain text in the firms table and profile page. Users need to manually navigate to Companies House to look up a firm — an extra friction step when reviewing ownership or company status.

## Solution

Wrap the CH number value in an `<a>` tag linking to `https://find-and-update.company-information.service.gov.uk/company/{chNumber}` with `target="_blank" rel="noopener noreferrer"`. Apply to all places the CH number is rendered (firms table column, firm profile header/edit dialog). Use `isSafeUrl` or a hardcoded base URL (not user-supplied) to avoid open-redirect risk.
