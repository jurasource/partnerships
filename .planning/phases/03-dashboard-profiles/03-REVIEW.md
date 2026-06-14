---
phase: 03-dashboard-profiles
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/app/firms/[id]/page.tsx
  - src/app/page.tsx
  - src/components/dashboard/comparison-table-filter.tsx
  - src/components/dashboard/comparison-table.tsx
  - src/components/dashboard/firm-refresh-action.tsx
  - src/components/firms/citation-panel.tsx
  - src/components/firms/contract-history-table.tsx
  - src/components/firms/findings-by-topic.tsx
  - src/components/firms/firm-profile-page.tsx
  - src/components/firms/firm-refresh-action.tsx
  - src/lib/queries/comparison-rows.test.ts
  - src/lib/queries/comparison-rows.ts
  - src/lib/queries/firm-profile.ts
  - src/lib/queries/firm-profile.test.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed 14 source files covering the dashboard comparison table, firm profile page, query layer, and associated tests. The data query layer is clean and the UI structure is mostly sound. Three critical defects were found: an unbounded polling loop that never times out (leaking intervals and toast IDs forever in the network-failure path), XSS-equivalent open redirect via user-controlled `sourceUrl` rendered as an `href` with no scheme validation, and a filter state divergence bug where external column filter changes are silently discarded. Several correctness and robustness warnings were also found.

---

## Critical Issues

### CR-01: Unbounded Polling — Interval Never Cleared on Persistent Network Failure

**File:** `src/components/firms/firm-refresh-action.tsx:71-115`, `src/components/dashboard/firm-refresh-action.tsx:79-115`

**Issue:** The `setInterval` poll loop is only terminated when the API returns `status === "done"` or `status === "failed"`. When the status endpoint returns a non-OK HTTP response (`!res.ok`), the handler does `return` and leaves the interval running indefinitely. If the status route is down or the job ID becomes invalid (e.g., the DB is wiped and restarted), the interval runs forever — the user sees a permanently spinning button and a stuck loading toast with no way to recover other than a page refresh. There is no timeout or maximum retry count guard. The `setRunning(false)` path is never reached, permanently blocking the user from re-triggering research for that firm in the same session. The same defect exists verbatim in both the dashboard and the profile variants.

**Fix:**
```ts
const MAX_POLLS = 60; // 60 × 2.5 s = 2.5 minutes maximum
let pollCount = 0;

intervalRef.current = setInterval(async () => {
  pollCount++;
  try {
    const res = await fetch(`/api/research/status/${jobId}`);
    if (!res.ok) {
      if (pollCount >= MAX_POLLS) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        toast.error(`Research timed out for ${firmName}. Try again.`, { id: toastId });
        setRunning(false);
      }
      return;
    }
    // ... existing done/failed handling ...
  } catch {
    if (pollCount >= MAX_POLLS) {
      clearInterval(intervalRef.current!);
      intervalRef.current = null;
      toast.error(`Research failed for ${firmName}. Try again.`, { id: toastId });
      setRunning(false);
    }
  }
}, POLL_INTERVAL_MS);
```

---

### CR-02: Open `href` with Unvalidated User-Controlled URL (Potential javascript: XSS)

**File:** `src/components/firms/findings-by-topic.tsx:126-133`, `src/components/firms/citation-panel.tsx:132-136`, `src/components/firms/citation-panel.tsx:147-153`

**Issue:** The `sourceUrl` field is pulled directly from the database and rendered into `href` attributes in anchor tags without any URL scheme validation. Although `sourceUrl` comes from the research worker (not direct user input), any path that allows a finding to be stored with a `javascript:` URL would execute arbitrary script when a user clicks the citation link. The `rel="noopener noreferrer"` guard does not prevent `javascript:` URIs — it only prevents window opener access. Because the DB schema stores `sourceUrl` as unconstrained text and the not-found sentinel (`"not-found"`) is already a special non-URL value, the field clearly accepts arbitrary strings. The same raw-`href` pattern appears in three rendering sites.

**Fix:** Validate that the URL has a safe scheme before rendering. Add a shared utility:
```ts
// src/lib/utils.ts (or a new src/lib/url-utils.ts)
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
```
Then guard each anchor:
```tsx
// findings-by-topic.tsx line 126
{isSafeUrl(entry.finding.sourceUrl) && (
  <a
    href={entry.finding.sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    ...
  >
```
Apply the same guard in `citation-panel.tsx` (lines 132 and 147).

---

### CR-03: Filter State Divergence — `onColumnFiltersChange` Discards External Updates

**File:** `src/components/dashboard/comparison-table.tsx:170-199`

**Issue:** The component maintains two related state variables: `activeTags` (the source of truth for the UI toggle bar) and `columnFilters` (passed to TanStack Table). The `useEffect` at line 173 syncs `activeTags` → `columnFilters`. However, `onColumnFiltersChange: setColumnFilters` is also passed to the table at line 193, meaning TanStack Table can call `setColumnFilters` directly (e.g., when `autoRemove` fires). When that happens, `columnFilters` is updated but `activeTags` is not, so the toggle buttons and the actual filter applied by the table diverge — the filter bar shows tags as inactive when the table is still filtering by them (or vice versa). More subtly, the `useEffect` depends only on `activeTags`, so if `columnFilters` is set externally and then `activeTags` changes for any reason, the effect overwrites the column filter entirely, discarding any table-internal filter state.

The correct pattern is to use `activeTags` as the single source of truth and derive column filters inline, removing the `onColumnFiltersChange` handler so TanStack Table cannot write to `columnFilters` independently.

**Fix:**
```tsx
// Remove the useEffect and the separate columnFilters state entirely.
// Compute columnFilters inline:
const columnFilters: ColumnFiltersState = React.useMemo(
  () =>
    activeTags.length > 0
      ? [{ id: "capabilityTags", value: activeTags }]
      : [],
  [activeTags],
);

const table = useReactTable({
  data: rows,
  columns,
  state: { sorting, columnFilters },
  onSortingChange: setSorting,
  // Do NOT pass onColumnFiltersChange — activeTags is the only write path
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  filterFns: { capabilityTagFilter: capabilityTagFilterFn },
});
```

---

## Warnings

### WR-01: `getFirmProfile` Makes Four Sequential Awaits That Could Be Parallelised — Correctness Risk if Topic Added Concurrently

**File:** `src/lib/queries/firm-profile.ts:53-113`

**Issue:** The four DB reads (firm, topics, findings, procurement records) are performed sequentially with four separate `await` calls. Beyond being slower than necessary, there is a TOCTOU window: a new topic can be inserted after query 2 (topics) completes but before query 3 (findings) completes, causing the returned `findingsByTopic` to contain a topic that has no corresponding finding slot — this is actually intended and correct. However, if a finding is inserted for that new topic between query 2 and query 3, the finding row will exist in `firmFindings` but no topic entry in `allTopics` will match it, meaning the finding is silently dropped. In a multi-tab scenario (user opens profile in two tabs; second tab triggers research that inserts a new topic-finding pair), the first tab's profile will miss a finding without any indication.

The safer approach is to fetch topics and findings in parallel and, if atomicity matters, use a single transaction.

**Fix:**
```ts
const [allTopics, firmFindings, contracts] = await Promise.all([
  db.select().from(topics),
  db.select().from(findings).where(eq(findings.firmId, firmId)).orderBy(desc(findings.createdAt)),
  db.select().from(procurementRecords).where(eq(procurementRecords.firmId, firmId)).orderBy(desc(procurementRecords.awardDate)),
]);
```

---

### WR-02: `capabilityTags` JSON Parse Attempted Twice with No Shared Fallback

**File:** `src/components/firms/firm-profile-page.tsx:48-52`, `src/components/dashboard/comparison-table.tsx:91-97`

**Issue:** Both files independently parse `firm.capabilityTags` (a raw JSON string from the DB) inside a `try/catch`, silently falling back to `[]` on error. This pattern is duplicated in at least two places with no shared utility. A corrupted capability tag stored in the DB (e.g., a truncated JSON write) would silently display "None" with no logging, making the data loss invisible. Additionally, `firm-profile-page.tsx` parses the string at component render time (a server component), but the schema confirms `capabilityTags` is always `NOT NULL DEFAULT '[]'`, so truly invalid JSON can only come from a direct DB edit or a bug upstream — silent suppression of that bug makes it harder to diagnose.

**Fix:** Extract a shared `parseCapabilityTags(raw: string): string[]` utility in `src/lib/utils.ts` that logs a warning (using `console.warn` in development) when parsing fails before returning `[]`. Replace both inline `try/catch` blocks with calls to this utility.

---

### WR-03: `awardDate` Sorted as String ("alphanumeric") — Incorrect for ISO Dates with Nulls

**File:** `src/components/firms/contract-history-table.tsx:136`

**Issue:** The `awardDate` column uses `sortingFn: "alphanumeric"`. ISO 8601 date strings (`YYYY-MM-DD`) do sort correctly as strings for non-null values, but TanStack Table's `alphanumeric` sort function does not handle `null` values consistently — null rows may sort before or after valid dates depending on the TanStack version. The `ContractRow` type explicitly declares `awardDate: string | null`, confirming nulls are expected. The default sort is `desc: true` (most recent first), but null award dates will sort erratically. The `noticeDate` column is displayed as the "Date" column header but the accessor is `awardDate` (line 130-136), which is a label mismatch but less critical since it is consistent with the displayed column.

**Fix:** Provide an explicit sorting function that treats nulls as lowest:
```ts
sortingFn: (rowA, rowB, columnId) => {
  const a = rowA.getValue<string | null>(columnId);
  const b = rowB.getValue<string | null>(columnId);
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
},
```

---

### WR-04: Test Mock for `comparison-rows` Does Not Match Actual Query Chain

**File:** `src/lib/queries/comparison-rows.test.ts:86-106`

**Issue:** The mock at line 86 provides two chain shapes for call 2 (procurement counts): `.from().groupBy()` and `.from().leftJoin().groupBy()`. The actual implementation in `comparison-rows.ts` uses `.from(procurementRecords).groupBy(procurementRecords.firmId)` — no `leftJoin`. The mock correctly covers this path. However, the mock also unnecessarily exposes a `.leftJoin()` chain that does not correspond to any code path in the current implementation. This is benign now, but if the implementation is refactored to a LEFT JOIN approach, the test will continue to pass even if the chain is wrong — the overly permissive mock defeats the purpose of the chain assertion. Additionally, the hoisted `mockLeftJoin` variable is declared in `vi.hoisted()` but is never actually used anywhere in the test file (the `buildSelectMock` function constructs closures; the named mock refs are unused).

**Fix:** Remove `mockLeftJoin`, `mockGroupBy`, and `mockFrom` from the hoisted block — they are unreferenced dead exports. Tighten the mock to only expose the chain shape that the current implementation exercises:
```ts
// call 2: only the .from().groupBy() path
return {
  from: () => ({
    groupBy: () => Promise.resolve(contractCountRows),
  }),
};
```

---

### WR-05: `CitationPanel` Uses Array Index as React Key — Breaks with Re-ordering

**File:** `src/components/firms/citation-panel.tsx:98-109`

**Issue:** Citation entries are rendered with `key={\`structured-${i}\`}` and `key={\`ai-${i}\`}` where `i` is the array index within each group. If the `findingsByTopic` prop changes (e.g., after a refresh action completes and the server revalidates), entries may be added, removed, or reordered. Index-based keys cause React to reuse DOM nodes incorrectly — a stale citation from position 0 may have its state and DOM recycled onto a completely different source after the array changes. Since citation entries contain anchor elements that open external links, this could surface the wrong URL to a user if they interact with a citation just as data refreshes.

**Fix:** Use a stable unique key derived from the citation's content. The combination of `sourceUrl` and `topicName` is unique within each group:
```tsx
{structuredEntries.map((entry) => (
  <CitationEntry key={`${entry.topicName}::${entry.sourceUrl}`} entry={entry} />
))}
```

---

## Info

### IN-01: Duplicated `TAG_STYLES` Constant Across Two Components

**File:** `src/components/dashboard/comparison-table.tsx:37-41`, `src/components/firms/firm-profile-page.tsx:12-16`

**Issue:** The `TAG_STYLES` record and the `CapabilityBadge` component are copy-pasted verbatim between `comparison-table.tsx` and `firm-profile-page.tsx`. Both files maintain identical mappings for `Nuclear`, `Infrastructure`, and `Consultancy`. When a new capability tag is added, both files must be updated manually — one will likely be missed.

**Fix:** Extract to a shared module, e.g., `src/components/firms/capability-badge.tsx`, and import it in both consuming files.

---

### IN-02: `defaultTab` Uses Optional Chaining Unnecessarily After Length Guard

**File:** `src/components/firms/findings-by-topic.tsx:73`

**Issue:** Line 60 already returns early when `findingsByTopic.length === 0`, so by line 73 the array is guaranteed non-empty. The expression `findingsByTopic[0]?.topic.id` uses unnecessary optional chaining — `findingsByTopic[0].topic.id` is always defined at this point. The `?.` chain also returns `undefined` rather than a string when (impossibly) the array is empty, potentially passing `undefined` as the `defaultValue` prop to `<Tabs>`, which could cause a subtle runtime warning.

**Fix:**
```ts
const defaultTab = findingsByTopic[0].topic.id; // guaranteed non-empty by early return above
```

---

### IN-03: `FirmRefreshAction` in `firm-profile-page.tsx` Is a Server Component Importing a Client Action

**File:** `src/components/firms/firm-profile-page.tsx:5-6`

**Issue:** `FirmProfileLayout` has no `"use client"` directive, making it a React Server Component. It imports `FirmRefreshAction` from `@/components/firms/firm-refresh-action` which has `"use client"` — this is allowed by Next.js (server components can render client components as leaves). However, `FirmRefreshAction` is also imported and rendered from the server component alongside `FindingsByTopic` and `CitationPanel` which are also client components. All three of these client components end up in the same client boundary. This is not a bug but worth noting: if `FirmProfileLayout` is ever given `"use client"`, the `runResearch` server action import in `firm-refresh-action.tsx` will fail at build time because server actions cannot be imported into client-only modules that are not using the actions import pattern correctly. Currently safe, but fragile.

No code change needed now; document the constraint in a comment in `firm-profile-page.tsx` so it is not accidentally broken during refactoring.

---

_Reviewed: 2026-06-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
