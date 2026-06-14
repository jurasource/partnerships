---
created: 2026-06-14T17:03:58.403Z
title: Clarify "Cons" abbreviation means Consultancy not Construction
area: general
files:
  - src/components/dashboard/comparison-table-filter.tsx
  - src/components/firms/firm-profile-page.tsx
---

## Problem

The capability tag "Cons" is currently used as an abbreviation. There is a risk that readers interpret it as "Construction" rather than "Consultancy". This ambiguity is present in planning documents, code comments, UI labels, and potentially seed data.

## Solution

1. Search all planning docs (`.planning/`) for any reference to "Cons" and add an explicit note that it means "Consultancy".
2. In code, ensure any `TAG_STYLES`, filter labels, badge labels, and constants that render "Cons" either spell out "Consultancy" in full, or include a tooltip clarifying the meaning.
3. Check seed data and DB comments for the same ambiguity.
