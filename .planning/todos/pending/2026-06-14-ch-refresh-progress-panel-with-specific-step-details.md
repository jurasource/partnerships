---
created: 2026-06-14T17:03:58.403Z
title: CH refresh progress panel with specific step-by-step details
area: ui
files:
  - src/components/firms/firm-refresh-action.tsx
  - src/app/api/research/status/[jobId]/route.ts
---

## Problem

When the "Refresh CH" (Companies House data refresh) runs, the progress indicator is too generic. The user has no visibility into which step is executing (e.g. "Fetching company profile", "Fetching officers", "Fetching PSC register", "Matching procurement records"), so they cannot tell if the job is progressing normally or hung.

## Solution

1. Enrich the status API response to include a `currentStep` string and optionally a `stepsCompleted` / `totalSteps` count.
2. Update the progress panel UI to display the current step label and a step counter (e.g. "3 / 5 — Matching procurement records").
3. Optionally: stream step updates via SSE instead of polling so the display is more real-time.
