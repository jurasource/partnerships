---
status: complete
phase: 01-data-foundation
source: [01-VERIFICATION.md]
started: 2026-06-14T08:55:59Z
updated: 2026-06-14T08:55:59Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar collapse/expand and active-route indicator
expected: Sidebar collapses to 56px icon rail and expands back. Active route shows blue-600 accent indicator. Tooltips show labels when collapsed.
result: pass

### 2. Capability badge colours and CH number mono font
expected: Nuclear=amber, Infrastructure=sky, Construction=violet tint badges in the Firms table. Companies House numbers render in Geist Mono (right-aligned).
result: pass
notes: "Two issues noted during this test — logged as gaps below."

### 3. Add Firm persists across dev-server restart
expected: Add a firm via the dialog, restart `npm run dev`, and the firm still appears in the Firms list (stored in SQLite on disk).
result: pass

### 4. Firm edit and delete flows with AlertDialog
expected: Edit firm opens dialog pre-populated with current values and updates on save. Delete shows AlertDialog with exact copy "This will permanently remove {name} and all associated research data." and removes the row.
result: pass

### 5. Topics CRUD with delete AlertDialog
expected: Add, edit, and delete topics. Delete AlertDialog shows "This will permanently remove the topic and all associated research findings." and removes the row.
result: pass
notes: "Actual dialog copy is 'Findings tied to this topic will be removed in future research runs.' — user prefers this wording. Two layout issues logged as gaps."

### 6. Search CH live Companies House lookup (requires API key)
expected: With COMPANIES_HOUSE_API_KEY set in .env.local, typing a company name in the Search CH field in the Add/Edit Firm dialog returns suggestions from Companies House and auto-fills the CH number on selection.
result: pass
notes: "UX issue logged — field placeholder implies number-only input, making name-based search non-obvious."

### 7. Per-firm refresh live data pull (requires API key)
expected: With COMPANIES_HOUSE_API_KEY set, clicking the refresh icon on a firm row shows a spinner, enqueues a job, and on completion shows a toast. Procurement records appear in the database if the firm has relevant contracts.
result: issue
reported: "Spinner spins but no indication anything is actually happening — no logs, no status messages, no progress, no indication of expected duration. Unclear whether the refresh is working or stuck."
severity: major

## Summary

total: 7
passed: 6
issues: 6
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "App uses a crisp, modern font that feels sharp and contemporary"
  status: failed
  reason: "User reported: general font is too boring, should be crisper and more modern"
  severity: cosmetic
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "DialogTrigger renders as a native button with no console errors"
  status: failed
  reason: "User reported: console error 'Base UI: A component that acts as a button expected a native <button> because the nativeButton prop is true' on navigation. DialogTrigger in FirmFormDialog used render={<span />} wrapping children instead of render={button element} directly."
  severity: major
  test: nav
  root_cause: "firm-form-dialog.tsx:193 — render={<span />} overrode the trigger element with a non-button span. Fix applied: changed to render={trigger ?? defaultTrigger} so Base UI receives a native button element."
  artifacts:
    - path: "src/components/firms/firm-form-dialog.tsx"
      issue: "DialogTrigger render prop was a span wrapper instead of the button element — fixed"
  missing: []
  debug_session: ""

- truth: "CH search field makes it clear that company name search is supported, not just number entry"
  status: failed
  reason: "User reported: not intuitive that you can type a name — placeholder (e.g. 03846738) implies number-only input"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Topics table is responsive — description column wraps and edit/delete actions are visible without horizontal scrolling"
  status: failed
  reason: "User reported: table too wide, must scroll horizontally to reach edit/delete links; description should wrap"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Per-firm refresh shows live progress — status messages, expected duration, and completion toast"
  status: failed
  reason: "User reported: spinner spins but no indication of what is happening — no logs, no status messages, no progress feedback, no expected duration shown"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Capability category is named 'Consultancy' not 'Construction'"
  status: failed
  reason: "User reported: 'Construction' should be 'Consultancy'"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
