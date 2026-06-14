---
created: 2026-06-14T14:10:00.000Z
title: Show Companies House summary panel in firm edit dialog
area: ui
files:
  - src/components/firms/firm-form-dialog.tsx
---

## Problem

When a user edits a firm and sets (or changes) the Companies House number, they have no way to confirm the match is correct — they'd have to manually look up the CH number separately. This creates friction and risk of mismatched firms.

## Solution

In the firm edit dialog, add a read-only CH summary panel that appears when a CH number is present. It should show key fields fetched from the cached CH profile (company name, status, jurisdiction, registered address, incorporation date, PSC/ownership summary) so the user can visually confirm the right company is matched at a glance. Also include a direct link to the Companies House public register page for that number:

`https://find-and-update.company-information.service.gov.uk/company/{companiesHouseNumber}`

Implementation notes:
- The CH profile data is already cached in the DB from Phase 1 refresh (companies_house_profiles or similar) — read from there rather than calling the live API on every dialog open.
- If no cached profile exists yet (CH number set but refresh not yet run), show a placeholder "Run a data refresh to load Companies House details."
- The panel should be visually distinct from the editable fields (e.g. a muted/card background) to make clear it is read-only.
- The CH link should open in a new tab.
