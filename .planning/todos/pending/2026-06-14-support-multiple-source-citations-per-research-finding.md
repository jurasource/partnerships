---
created: 2026-06-14T18:19:27.763Z
title: Support multiple source citations per research finding
area: api
files:
  - src/lib/research/schemas.ts
  - src/lib/research/worker.ts
  - src/db/schema.ts
  - src/components/firms/citation-panel.tsx
---

## Problem

Each research finding currently stores exactly one source URL (`sourceUrl`, `sourceTitle`, `rawSnippet`). Tavily returns multiple search results per query and the worker synthesises them but only persists one citation. When multiple sources corroborate a finding or provide complementary evidence (e.g., two news articles confirming a partnership), the extra supporting evidence is silently discarded.

The current design was intentional for Phase 2 simplicity, but it limits citation richness — especially for HIGH-confidence findings where cross-referencing multiple sources would increase trust in the output.

## Solution

Two options:

**Option A — `citations` array on the finding (schema-level change):**
- Extend `FindingSchema` (Zod) to add `citations: z.array(...)` with url/title/snippet per entry, keeping `sourceUrl` as the "primary" citation for backwards compatibility
- Add a `finding_citations` table in the DB (or store as JSON blob in findings.citations column) — a separate junction table is cleaner for querying
- Update `worker.ts` to pass all retrieved Tavily results to the LLM prompt and ask it to list supporting URLs, then persist them
- Update `citation-panel.tsx` to render the full citation list

**Option B — filter Tavily results to top-N matching the finding:**
- Post-process after LLM generates the finding: find all Tavily result URLs whose snippets semantically relate to the finding summary
- Simpler — no schema change needed if stored as a JSON array in an existing nullable column
- Less precise than asking the LLM to identify its own supporting sources

Option A is more trustworthy (LLM explicitly cites what it used). Start there.

Note: The citation-origin gate (`E4` in worker.ts) already validates that MEDIUM-confidence `sourceUrl` is in the Tavily result set — this gate logic would need extending for multiple citations too.
