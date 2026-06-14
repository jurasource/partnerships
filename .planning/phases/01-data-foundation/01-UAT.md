---
status: testing
phase: 01-data-foundation
source: [01-VERIFICATION.md]
started: 2026-06-14T08:55:59Z
updated: 2026-06-14T08:55:59Z
---

## Current Test

number: 1
name: Sidebar collapse/expand and active-route indicator
expected: |
  Sidebar collapses to 56px icon rail and expands back. Active route (Dashboard / Firms / Topics)
  shows blue-600 accent indicator. Tooltips appear when collapsed.
awaiting: user response

## Tests

### 1. Sidebar collapse/expand and active-route indicator
expected: Sidebar collapses to 56px icon rail and expands back. Active route shows blue-600 accent indicator. Tooltips show labels when collapsed.
result: [pending]

### 2. Capability badge colours and CH number mono font
expected: Nuclear=amber, Infrastructure=sky, Construction=violet tint badges in the Firms table. Companies House numbers render in Geist Mono (right-aligned).
result: [pending]

### 3. Add Firm persists across dev-server restart
expected: Add a firm via the dialog, restart `npm run dev`, and the firm still appears in the Firms list (stored in SQLite on disk).
result: [pending]

### 4. Firm edit and delete flows with AlertDialog
expected: Edit firm opens dialog pre-populated with current values and updates on save. Delete shows AlertDialog with exact copy "This will permanently remove {name} and all associated research data." and removes the row.
result: [pending]

### 5. Topics CRUD with delete AlertDialog
expected: Add, edit, and delete topics. Delete AlertDialog shows "This will permanently remove the topic and all associated research findings." and removes the row.
result: [pending]

### 6. Search CH live Companies House lookup (requires API key)
expected: With COMPANIES_HOUSE_API_KEY set in .env.local, typing a company name in the Search CH field in the Add/Edit Firm dialog returns suggestions from Companies House and auto-fills the CH number on selection.
result: [pending]

### 7. Per-firm refresh live data pull (requires API key)
expected: With COMPANIES_HOUSE_API_KEY set, clicking the refresh icon on a firm row shows a spinner, enqueues a job, and on completion shows a toast. Procurement records appear in the database if the firm has relevant contracts.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
