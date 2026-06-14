---
created: 2026-06-14T16:29:54.449Z
title: Clarify AI research vs structured data refresh buttons in UI
area: ui
files:
  - src/components/firms/firm-row-research.tsx
  - src/app/page.tsx
---

## Problem

The app currently has (or will have) two distinct refresh actions per firm, and the difference between them isn't obvious to users:

1. **"Run AI Research"** — triggers the AI-assisted research loop (Phase 2): calls Tavily search + Claude to produce findings with citations, stored in the `findings` table. This is the slow, expensive, LLM-powered step.

2. **"Refresh CH / Contracts Finder / Find a Tender"** — re-fetches structured public data from Companies House, Contracts Finder, and Find a Tender APIs (Phase 1 UK data layer). This is fast, deterministic, no LLM involved, just raw API calls updating `contracts` / ownership records.

A user clicking around the dashboard would have no idea why there are two buttons or which one to press. The labels likely don't make this clear.

## Solution

- Rename / relabel buttons so the distinction is immediately apparent without needing to know the system internals:
  - AI research button: e.g. "Research (AI)" or "Run Research" with a brain/sparkle icon and tooltip: "Uses AI to search the web and produce sourced findings for each topic"
  - Structured data button: e.g. "Refresh Public Records" or "Fetch UK Data" with a database icon and tooltip: "Re-fetches Companies House, Contracts Finder, and Find a Tender records"
- Consider combining into one "Refresh" action that runs both sequentially, with the two steps shown as progress stages — unless there's a reason to keep them separate (cost, speed difference).
- Add tooltips (shadcn Tooltip) on both buttons explaining what each does in plain English.
