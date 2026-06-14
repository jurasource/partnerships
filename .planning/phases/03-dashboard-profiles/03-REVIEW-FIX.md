---
phase: 03-dashboard-profiles
fixed_at: 2026-06-14T00:00:00Z
review_path: .planning/phases/03-dashboard-profiles/03-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-14T00:00:00Z
**Source review:** .planning/phases/03-dashboard-profiles/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical, 5 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Unbounded Polling — Interval Never Cleared on Persistent Network Failure

**Files modified:** `src/components/firms/firm-refresh-action.tsx`, `src/components/dashboard/firm-refresh-action.tsx`
**Commit:** dcc1700
**Applied fix:** Added `MAX_POLLS = 60` (2.5 minute cap at 2.5 s intervals) and a `pollCount` counter in both polling `setInterval` callbacks. When `!res.ok` is returned, the counter is incremented and checked — if the limit is reached, the interval is cleared, a timeout toast is shown, and `setRunning(false)` is called. The same timeout check is applied in the `catch` block for network errors, and for stuck-in-pending status (poll count reached without `done` or `failed`). Both the firm profile variant and the dashboard variant received identical fixes.

---

### CR-02: Open `href` with Unvalidated User-Controlled URL (Potential javascript: XSS)

**Files modified:** `src/lib/utils.ts`, `src/components/firms/findings-by-topic.tsx`, `src/components/firms/citation-panel.tsx`
**Commit:** 95cc679
**Applied fix:** Added `isSafeUrl(url: string): boolean` to `src/lib/utils.ts` using `new URL()` to parse the URL and only returning `true` for `http:` and `https:` protocols. In `findings-by-topic.tsx` the citation anchor is now wrapped in `{isSafeUrl(entry.finding.sourceUrl) && (<a ...>)}`. In `citation-panel.tsx` a `safeUrl` local variable gates both anchor render paths (the Tooltip-wrapped long URL path and the plain short URL path). Note: `parseCapabilityTags` was also added to `utils.ts` in this commit as it was a natural companion utility (consumed by WR-02 fix).

---

### CR-03: Filter State Divergence — `onColumnFiltersChange` Discards External Updates

**Files modified:** `src/components/dashboard/comparison-table.tsx`
**Commit:** 55b690c
**Applied fix:** Removed the separate `columnFilters` `useState` and the `useEffect` that synced `activeTags` into it. `columnFilters` is now a `const` computed via `React.useMemo` directly from `activeTags`, making `activeTags` the single source of truth. Removed `onColumnFiltersChange: setColumnFilters` from the `useReactTable` config so TanStack Table cannot write to column filter state independently and cause divergence between the toggle bar and the applied filter.

---

### WR-01: `getFirmProfile` Makes Four Sequential Awaits That Could Be Parallelised

**Files modified:** `src/lib/queries/firm-profile.ts`
**Commit:** 8818bf0
**Applied fix:** Replaced the three sequential `await` calls for topics, findings, and procurement records with a single `await Promise.all([...])` destructuring. The firm row lookup (step 1) remains a separate sequential `await` since the function returns `null` immediately if no firm is found — parallelising it with the other queries would waste work in the not-found case.

---

### WR-02: `capabilityTags` JSON Parse Attempted Twice with No Shared Fallback

**Files modified:** `src/components/firms/firm-profile-page.tsx`, `src/components/dashboard/comparison-table.tsx`
**Commit:** 9680357
**Applied fix:** Both inline `try/catch` JSON parse blocks replaced with calls to `parseCapabilityTags(raw)` from `src/lib/utils.ts`. The shared utility logs `console.warn` in non-production environments when parsing fails, making upstream data corruption visible. `firm-profile-page.tsx` changed from `let capabilityTags: string[] = []; try { ... } catch { ... }` to a single `const capabilityTags = parseCapabilityTags(firm.capabilityTags)`. The `accessorFn` in `comparison-table.tsx` was reduced to a single function call.

---

### WR-03: `awardDate` Sorted as String ("alphanumeric") — Incorrect for ISO Dates with Nulls

**Files modified:** `src/components/firms/contract-history-table.tsx`
**Commit:** 62c84b3
**Applied fix:** Replaced `sortingFn: "alphanumeric"` with an explicit inline comparator that returns `0` when both values are null, `-1` when only `a` is null (nulls sort lowest, i.e., before valid dates), `1` when only `b` is null, and a string comparison otherwise. With the default `desc: true` sort this places null award dates at the end of the list (after all dated records), which is the expected behaviour for "most recent first, undated last".

---

### WR-04: Test Mock for `comparison-rows` Does Not Match Actual Query Chain

**Files modified:** `src/lib/queries/comparison-rows.test.ts`
**Commit:** af6c2c1
**Applied fix:** Removed `mockLeftJoin`, `mockGroupBy`, and `mockFrom` from the `vi.hoisted()` block — all three were declared but never referenced anywhere in the test file. Tightened the call-2 mock in `buildSelectMock` to only expose `.from().groupBy()`, removing the dead `.leftJoin().groupBy()` alternative that would have allowed an incorrect query chain refactor to pass tests silently.

---

### WR-05: `CitationPanel` Uses Array Index as React Key — Breaks with Re-ordering

**Files modified:** `src/components/firms/citation-panel.tsx`
**Commit:** ca3b339
**Applied fix:** Replaced `` key={`structured-${i}`} `` and `` key={`ai-${i}`} `` (index-based) with `` key={`${entry.topicName}::${entry.sourceUrl}`} `` in both the `structuredEntries.map` and `aiEntries.map` calls. The `(entry, i)` parameters were simplified to `(entry)` now that the index is no longer needed. The `topicName::sourceUrl` combination is unique within each source-type group and remains stable across refreshes.

---

_Fixed: 2026-06-14T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
