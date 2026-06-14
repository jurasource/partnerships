---
phase: 02-research-engine
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - package.json
  - src/db/schema.ts
  - src/lib/search/types.ts
  - src/lib/search/tavily.ts
  - src/lib/research/schemas.ts
  - src/lib/research/grounding.ts
  - src/lib/research/prompts.ts
  - src/lib/research/worker.ts
  - src/lib/research/worker.test.ts
  - src/lib/actions/research-actions.ts
  - src/app/api/research/run/route.ts
  - src/app/api/research/run/route.test.ts
  - src/app/api/research/status/[jobId]/route.ts
  - src/components/firms/firm-row-research.tsx
  - src/components/firms/firms-table.tsx
  - src/components/research/job-status-badge.tsx
  - src/components/research/staleness-badge.tsx
  - src/components/ui/progress.tsx
findings:
  critical: 5
  warning: 6
  info: 3
  total: 14
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

The research engine is well-structured overall: the dependency-injection pattern for the search client is sound, the citation-origin gate (E4) adds a meaningful hallucination guard, and the job lifecycle is durable. However, five critical defects were found — two in the unauthenticated API endpoint, one interval leak in the polling component, one data duplication bug in the worker, and one invalid PSC nationality filter producing misleading ownership intelligence. Six warnings cover robustness gaps in error propagation, a hardcoded magic number that will silently diverge from the DB, and a progress bar rendering defect.

---

## Critical Issues

### CR-01: /api/research/run is unauthenticated and accepts any firmId/jobId

**File:** `src/app/api/research/run/route.ts:38-88`

**Issue:** The POST endpoint has no authentication or authorization check. Any party that can reach the server can trigger a full AI/web-search research run for an arbitrary `firmId` and `jobId`. Because `jobId` is supplied by the caller rather than freshly generated here, a caller can also **hijack an existing job row** by passing someone else's valid `jobId` — the route immediately calls `updateJobStatus(jobId, "running", ...)` on whatever ID is supplied. For a local single-user tool this is lower risk, but the CLAUDE.md states "architecture should not preclude future cloud deployment", and this endpoint would be a serious authorization bypass at that point. More immediately: the route does not verify that the supplied `jobId` actually belongs to the supplied `firmId`. A mismatched pair silently updates the wrong job's status.

**Fix:** At minimum, verify that the job row exists and belongs to the supplied `firmId` before transitioning it:

```typescript
// After parsing firmId and jobId:
const job = await getJob(jobId);
if (!job) {
  return NextResponse.json({ error: "Job not found" }, { status: 404 });
}
if (job.firmId !== firmId) {
  return NextResponse.json({ error: "Job/firm mismatch" }, { status: 400 });
}
```

For future cloud deployment, add a pre-shared secret header check (e.g. `X-Internal-Secret`) so only the Next.js server action can invoke this route.

---

### CR-02: setInterval return value discarded — polling interval leaks on unmount

**File:** `src/components/firms/firm-row-research.tsx:75-116`

**Issue:** `handleResearch` is an async event handler, not a `useEffect`. The `return () => clearInterval(intervalId)` on line 116 is the return value of the async function, not a cleanup function registered with React. React never calls it. If the component unmounts while research is running (e.g. user navigates away), the interval continues firing indefinitely, making `fetch` calls against a status endpoint for a job that is already complete or no longer relevant. Over time (especially with multiple firms), this leaks memory and makes spurious network requests.

**Fix:** Track the interval in a ref and clean it up via `useEffect`:

```typescript
const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

// In handleResearch, replace setInterval usage:
intervalRef.current = setInterval(async () => {
  // ...existing polling logic...
  if (job.status === "done" || job.status === "failed") {
    if (intervalRef.current) clearInterval(intervalRef.current);
    // ...rest of done/failed logic...
  }
}, POLL_INTERVAL_MS);

// Add cleanup effect:
React.useEffect(() => {
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, []);
```

---

### CR-03: runResearchWorker inserts duplicate findings on re-run

**File:** `src/lib/research/worker.ts:124-133`

**Issue:** `db.insert(findings).values(...)` has no conflict-handling strategy. The `findings` table has no unique constraint on `(firmId, topicId)`. Running research twice for the same firm inserts a second row per topic without removing or replacing the first. The status endpoint at `/api/research/status/[jobId]` counts findings by `createdAt >= job.startedAt`, which works for progress tracking, but the findings table accumulates unbounded duplicate rows over multiple research runs. The UI and any future "latest finding" query will silently surface stale findings alongside fresh ones with no way to distinguish them without checking `createdAt`.

**Fix:** Either:
1. Add a unique index on `(firm_id, topic_id)` in `schema.ts` and use an upsert (`onConflictDoUpdate`) in the worker, or
2. Delete prior findings for the firm before starting the worker loop (`db.delete(findings).where(eq(findings.firmId, firmId))`).

Option 1 is more atomic:
```typescript
// schema.ts: add to findings table definition
(table) => [uniqueIndex("findings_firm_topic_unique").on(table.firmId, table.topicId)]

// worker.ts: use upsert
await db.insert(findings).values({ ... })
  .onConflictDoUpdate({
    target: [findings.firmId, findings.topicId],
    set: { summary, confidence, sourceUrl, sourceTitle, rawSnippet, createdAt: sql`(datetime('now'))` },
  });
```

---

### CR-04: PSC nationality filter incorrectly classifies entities — produces misleading ownership intelligence

**File:** `src/lib/research/grounding.ts:62-80`

**Issue:** The non-UK PSC filter checks `item.nationality` — a field that exists only on **natural persons** in the Companies House API. Corporate PSCs (which are common: holding companies, parent entities) have no `nationality` field; they have `country_of_residence` or are identified by their registered country. The filter silently skips all corporate PSCs (`item.nationality` is `undefined`), meaning a foreign-owned subsidiary with a corporate parent PSC will report "0 non-UK nationals" — the opposite of its actual ownership risk. This directly undermines the stated project goal of surfacing "which firms are not UK owned".

Additionally, filtering on `"british"` and `"uk"` as substring matches misses common Companies House spellings like `"United Kingdom"` (which doesn't contain "british" or "uk"). The string `"uk"` also risks false-positives for nationalities containing "uk" in other contexts.

**Fix:**
```typescript
// Check both persons and corporate entities
const nonUkPscs = psc.items.filter((item) => {
  // Natural person: check nationality
  if (item.nationality) {
    const nat = item.nationality.toLowerCase();
    return !nat.includes("british") && nat !== "united kingdom" && !nat.includes("english") && !nat.includes("scottish") && !nat.includes("welsh");
  }
  // Corporate PSC: check country_of_residence or identification.country_registered
  const country = (item.country_of_residence ?? item.identification?.country_registered ?? "").toLowerCase();
  if (!country) return true; // unknown origin — flag conservatively
  return country !== "england" && country !== "scotland" && country !== "wales" && country !== "northern ireland" && country !== "united kingdom" && country !== "england and wales";
});
```

---

### CR-05: Tavily API key sent in request body — should be in Authorization header

**File:** `src/lib/search/tavily.ts:51-58`

**Issue:** The Tavily API key is transmitted as `api_key` in the JSON request body. While HTTPS encrypts the transport, embedding secrets in the request body means the key appears in: server-side request logs, any reverse proxy access logs, and any middleware that logs request bodies. The Tavily API supports `Authorization: Bearer <key>` header authentication, which is the correct pattern — header auth is stripped by most logging infrastructure and is the industry standard for token-based APIs.

**Fix:**
```typescript
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${apiKey}`,
},
body: JSON.stringify({
  query,
  max_results: maxResults,
  // api_key removed from body
}),
```

---

## Warnings

### WR-01: Magic number `topicsTotal: 7` hardcoded in status endpoint — will silently diverge from DB

**File:** `src/app/api/research/status/[jobId]/route.ts:54`

**Issue:** `topicsTotal: 7` is hardcoded. The topics table is seeded with 7 entries, but the `buildColumns()` function in `firms-table.tsx` and `FirmRowResearch` also hardcode `TOPICS_TOTAL = 7`. If a user adds or removes topics via the (planned) config UI, the progress bar will show incorrect fractions (e.g. "7/7 complete" with 10 topics, stopping visually at 70%). The count should be derived from the DB at runtime.

**Fix:** In the status endpoint, query the count of topics from the DB rather than returning a constant:
```typescript
const [{ count: topicsTotal }] = await db
  .select({ count: count() })
  .from(topics);

return NextResponse.json({ ...job, topicsComplete, topicsTotal });
```
Also remove `TOPICS_TOTAL = 7` from `firm-row-research.tsx` and use the `topicsTotal` from the API response.

---

### WR-02: fire-and-forget fetch in server action swallows network failure silently

**File:** `src/lib/actions/research-actions.ts:50-58`

**Issue:** The `.catch(() => { })` silently discards errors if the fire-and-forget POST to `/api/research/run` fails (e.g. the server isn't listening, the URL is wrong, the request times out). The job is inserted into the DB as `"pending"` and never transitions. From the user's perspective, `runResearch` returned `{ ok: true, jobId }`, polling starts, but the job stays `"pending"` forever with no error surfaced.

**Fix:** Log the error so it is at least visible in server logs, and consider a timeout after which the action could return a distinct error state:
```typescript
fetch(workerUrl, { ... }).catch((err) => {
  console.error("[research-actions] fire-and-forget POST failed:", err);
  // Job will remain "pending" — user sees it stuck; at minimum this is now debuggable
});
```
A stronger fix would mark the job `"failed"` in this catch, but that requires the server action to know the jobId — which it already does:
```typescript
.catch(async () => {
  await updateJobStatus(jobId, "failed", {
    completedAt: new Date().toISOString(),
    errorMessage: "Worker trigger request failed — server may not be reachable.",
  });
});
```

---

### WR-03: Status endpoint uses `createdAt >= startedAt` for topic progress — subject to clock skew

**File:** `src/app/api/research/status/[jobId]/route.ts:37-48`

**Issue:** `gte(findings.createdAt, job.startedAt)` compares two SQLite `datetime('now')` strings generated at different points. Both are UTC ISO strings from the same process, so clock skew between machines is not a concern in local-first mode. However, `startedAt` is set by `nowIso()` (JavaScript `new Date().toISOString()`) in the route handler, while `findings.createdAt` uses SQLite's `datetime('now')` default. These are different clocks: Node.js `Date` and SQLite's internal clock. In practice they will be very close, but in a loaded system or with SQLite WAL mode, a finding could theoretically receive a `createdAt` that is fractionally earlier than the `startedAt` written by Node.js milliseconds later. This would cause `topicsComplete` to undercount by 1 for the first few findings, producing a brief "0/7" display even after the first topic completes.

**Fix:** Store `startedAt` using SQLite's `datetime('now')` rather than JavaScript's `new Date().toISOString()` so both timestamps share the same clock, or use a job-ID-based join rather than timestamp comparison:
```sql
-- Alternative: count findings joined to a job table on firmId + topicId
SELECT COUNT(DISTINCT topic_id) FROM findings WHERE firm_id = ? AND id IN (
  SELECT finding_id FROM job_findings WHERE job_id = ?
)
```
Or simplest fix: use a `jobId` foreign key column on findings rows written by this job, removing the timestamp comparison entirely.

---

### WR-04: Worker test uses module-level `dbSelectCallIndex` counter that breaks when tests run in unexpected order

**File:** `src/lib/research/worker.test.ts:75-103`

**Issue:** `dbSelectCallIndex` is a module-level integer incremented by each `db.select()` call. The mock assumes the first `select` is always the firm lookup and subsequent ones are topic queries. This assumption is fragile: if the worker's internal call order ever changes (e.g. a logging or validation step is added that queries the DB), or if vitest runs tests in parallel with shared module state, the wrong mock response is returned. The `beforeEach` resets `dbSelectCallIndex = 0` but `vi.clearAllMocks()` does not reset the closure-captured counter in the `vi.mock` factory, which runs once at module parse time — meaning the factory's counter capture is shared across all tests in the file.

**Fix:** Use separate, named mock functions for firm vs. topics queries rather than a positional counter:
```typescript
const mockFirmSelect = vi.fn().mockResolvedValue([MOCK_FIRM]);
const mockTopicsSelect = vi.fn().mockResolvedValue(MOCK_TOPICS);
// And distinguish via the `.from()` argument rather than call order.
```

---

### WR-05: `Progress` component renders children before `ProgressTrack` — semantic ordering issue

**File:** `src/components/ui/progress.tsx:18-24`

**Issue:** The `Progress` component spreads `{children}` before `<ProgressTrack>`. In `firm-row-research.tsx` the `Progress` component is called without children (`<Progress value={progressValue} className="h-1.5 w-full" />`), so this is harmless today. However, if a consumer passes children expecting them to appear inside or after the track (e.g. a `ProgressLabel`), they will appear before the track element in the DOM, producing unexpected visual output. The `ProgressLabel` and `ProgressValue` subcomponents are exported but unused and untested. The component's public API is misleading.

**Fix:** Document that `children` is rendered before the track, or restructure so children render after — or remove the `children` prop from the `Progress` component and require explicit use of `ProgressTrack`/`ProgressLabel`/`ProgressValue` sub-components.

---

### WR-06: `StalenessBadge` does not guard against invalid date strings

**File:** `src/components/research/staleness-badge.tsx:60-62`

**Issue:** `new Date(lastResearchedAt)` is called without validating the input. If `lastResearchedAt` is a malformed string (e.g. partial write during a crash, unexpected format), `new Date()` returns an `Invalid Date`, `researchedDate.getTime()` returns `NaN`, `diffMs` is `NaN`, `isStale` evaluates as `false` (NaN > number is false), and the component renders the "Researched NaN days ago" label with `formatRelativeDate` returning `"NaN days ago"` — surfaced directly to the user.

**Fix:**
```typescript
const researchedDate = new Date(lastResearchedAt);
if (isNaN(researchedDate.getTime())) {
  // Treat as not-researched rather than crashing or showing garbage
  return <Badge ...>Not researched</Badge>;
}
```

---

## Info

### IN-01: `desc` imported but unused in `grounding.ts`

**File:** `src/lib/research/grounding.ts:3`

**Issue:** `import { desc } from "drizzle-orm"` is on line 3, but `desc` is used on line 98 (`.orderBy(desc(procurementRecords.noticeDate))`). This import is actually used — however `eq` is imported twice: once on line 3 and once on line 4 as separate named imports from the same module. While functionally harmless, it suggests the file was assembled incrementally and the imports weren't cleaned up.

**Fix:** Consolidate into a single import:
```typescript
import { desc, eq } from "drizzle-orm";
```

---

### IN-02: `formatGroundingContext` is exported but never called

**File:** `src/lib/research/grounding.ts:132-147`

**Issue:** `formatGroundingContext` is exported and mocked in both test files, but it is never imported or called in the worker (`worker.ts`) or anywhere else in the reviewed files. The worker calls `buildGroundingContext` and passes the result directly to `buildTopicPrompt`, which formats it inline. The exported function is dead code.

**Fix:** Either delete `formatGroundingContext` or call it in the worker/prompts layer and remove the inline formatting from `buildTopicPrompt`.

---

### IN-03: `NOT_FOUND_SENTINEL` confidence is `"HIGH"` — this will confuse the UI's confidence filter

**File:** `src/lib/research/schemas.ts:57-65`

**Issue:** The sentinel representing "no finding was possible" uses `confidence: "HIGH"`. The comment explains the rationale ("we looked and found nothing is itself a definitive structured fact"), but this is a design-level concern: any future confidence filter in the UI will show sentinel rows labelled "HIGH confidence" alongside genuine Companies House-sourced facts. A user filtering for high-confidence findings will see "Not found: Model failed to produce structured output after retries" rows mixed with real data. The `sourceUrl: "not-found"` field can be used to distinguish them, but only if the UI is built to check it. This is currently undocumented at the UI layer.

**Fix:** Introduce a distinct sentinel confidence value (e.g. `"NOT_FOUND"`) in the DB enum and schema, or filter sentinel rows (where `source_url = 'not-found'`) out of any confidence-based UI query. At minimum, document this sentinel pattern in the UI-SPEC so future dashboard work accounts for it.

---

_Reviewed: 2026-06-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
