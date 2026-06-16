---
status: testing
phase: 05-consortium-recommender-initial-report
source: [05-VERIFICATION.md]
started: 2026-06-16T18:05:00Z
updated: 2026-06-16T18:05:00Z
---

## Current Test

number: 1
name: /report page browser render
expected: |
  "Initial Report" heading + "Best 1+1+1 consortium from seeded 12-firm dataset." sub-heading,
  primary card with 3 firms (one per capability), ownership/NSI/risk badges, "View reasoning" toggle.
  No weight sliders, lock section, recompute button, or Reset link (readOnly mode).
awaiting: user response

## Tests

### 1. /report page browser render
expected: "Initial Report" heading, primary firm cards with ownership/NSI/risk badges, collapsible "View reasoning", and no recompute/Reset controls (readOnly mode).
result: [pending]

### 2. /recommend interactive flow
expected: Accordion expand/collapse, submit disabled when mix=0, "Computing..." spinner during request, lock-and-recompute sets primary team as locked and re-submits, Reset clears locks, error toast on non-2xx response.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
