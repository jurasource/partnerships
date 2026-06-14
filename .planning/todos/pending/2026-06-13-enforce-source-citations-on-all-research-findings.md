---
created: 2026-06-13T16:44:06.281Z
title: Enforce source citations on all research findings
area: planning
files:
  - .planning/REQUIREMENTS.md:RES-03
  - .planning/research/SUMMARY.md
---

## Problem

All AI-derived research findings must include verifiable source references so the user can check them. This is a core trust requirement: the tool informs bid/consortium decisions, so unverified or unattributed claims are unacceptable. The research engine (Phase 2) must treat citations as mandatory, not optional — each finding must carry the source URL/title and the raw retrieved snippet that supports it.

This also applies to cross-cutting analysis (Phase 4): risk flags, COI/audit relationships, ownership chains, and partnership evidence must all be sourced and checkable, not AI-asserted conclusions.

## Solution

- Phase 2 (Research Engine): Enforce citation fields in the Zod `Finding` schema — if no source can be cited, output explicit "not found" rather than an unsourced claim
- Phase 4 (Cross-Cutting Analysis): All relationship records (conflicts, partnerships, ownership) must link to the source evidence (contract notice URL, news article, Companies House filing)
- Dashboard (Phase 3): Citation panel in the UI must surface sources per finding, clearly distinguishing structured API data from AI narrative
- Consider a `confidence` field alongside each citation: HIGH (from structured API), MEDIUM (AI with cited source), LOW (AI without verifiable source)

This is already captured in RES-03, RES-04, PROF-02, and ANAL-01 but flagged here as a cross-cutting architectural constraint to enforce consistently across all phases.
