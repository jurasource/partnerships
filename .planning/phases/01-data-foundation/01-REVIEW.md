---
phase: 01-data-foundation
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/app/firms/page.tsx
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/topics/page.tsx
  - src/components/app-sidebar.tsx
  - src/components/dashboard/comparison-table.tsx
  - src/components/firms/ch-search-field.tsx
  - src/components/firms/firm-form-dialog.tsx
  - src/components/firms/firm-row-refresh.tsx
  - src/components/firms/firms-table.tsx
  - src/components/topics/topic-form-dialog.tsx
  - src/components/topics/topics-table.tsx
  - src/db/client.ts
  - src/db/schema.ts
  - src/db/seed.ts
  - src/lib/actions/ch-search-actions.ts
  - src/lib/actions/firm-actions.ts
  - src/lib/actions/refresh-actions.ts
  - src/lib/actions/topic-actions.ts
  - src/lib/adapters/ocds.test.ts
  - src/lib/adapters/ocds.ts
  - src/lib/clients/companies-house.ts
  - src/lib/clients/contracts-finder.ts
  - src/lib/clients/find-a-tender.ts
  - src/lib/clients/http.ts
  - src/lib/jobs/queue.ts
  - src/lib/types.ts
findings:
  critical: 5
  warning: 7
  info: 4
  total: 16
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 1 implements the data foundation: SQLite schema via Drizzle, UK procurement API clients (Companies House, Contracts Finder, Find a Tender), an OCDS normalisation adapter, a job queue skeleton, and the Next.js 15 dashboard UI with CRUD server actions. The overall structure is coherent and the security posture at the server-action boundary is solid (Zod validation, parameterised queries, `server-only` guards, no raw SQL). However, five critical defects were found that cause data loss, silent incorrect behaviour, or crash risk; seven warnings identify logic gaps that will cause bugs under realistic operating conditions.

---

## Critical Issues

### CR-01: `enqueueJob` crashes on insert failure — unguarded array destructure

**File:** `src/lib/jobs/queue.ts:41`
**Issue:** `const [row] = await db.insert(jobs).values(...).returning(...)` destructures without checking whether `row` is defined. If the insert fails silently or the driver returns an empty array (e.g. a constraint violation on `firm_id` referencing a deleted firm), `row.id` throws `TypeError: Cannot read properties of undefined`. This crashes `refreshFirm` before the job is even enqueued, with no error surfaced to the user.

**Fix:**
```typescript
const [row] = await db
  .insert(jobs)
  .values({ firmId: input.firmId, topicId: input.topicId ?? null, status: "pending" })
  .returning({ id: jobs.id });

if (!row) {
  throw new Error("enqueueJob: insert returned no row — unexpected DB error");
}
return row.id;
```

---

### CR-02: `updateFirm` silently loses `updatedAt` on every mutation

**File:** `src/lib/actions/firm-actions.ts:137-153`
**Issue:** `updateValues` is built from only the four user-supplied fields. The `firms` table has an `updatedAt` column whose default is only applied at `INSERT` time (`datetime('now')`). SQLite `DEFAULT` values are **not** re-evaluated on `UPDATE`. Every call to `updateFirm` leaves `updatedAt` frozen at the original insert timestamp. The same defect applies to `updateTopic` in `topic-actions.ts:93-99`. Any future feature that relies on `updatedAt` for cache invalidation or "last refreshed" display will silently show stale data.

**Fix:** Add `updatedAt` to every update payload using Drizzle's `sql` helper:
```typescript
import { sql } from "drizzle-orm";

// inside updateFirm, after building updateValues:
updateValues.updatedAt = sql`(datetime('now'))`;

// same pattern in updateTopic
```

---

### CR-03: `normaliseChNumber` does NOT validate the 8-character format — passes arbitrary strings to the DB

**File:** `src/lib/adapters/ocds.ts:57-61`
**Issue:** The function accepts any non-empty trimmed string as a valid CH number. OCDS data from third parties frequently contains malformed or placeholder identifiers (e.g. `"N/A"`, `"0"`, `"unknown"`, free-form text). These strings pass through `normaliseChNumber` and are stored in `supplierChNumber`. Downstream logic in `matchFirmToSupplier` then compares these garbage strings against real CH numbers, producing false non-matches (and occasionally false positive matches if a firm happens to share a short identifier). The schema comment documents the 8-character rule explicitly but the code does not enforce it.

**Fix:**
```typescript
const CH_NUMBER_RE = /^([A-Z]{2}\d{6}|\d{8})$/;

function normaliseChNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim().toUpperCase();
  return CH_NUMBER_RE.test(trimmed) ? trimmed : null;
}
```

---

### CR-04: `ocds.ts` `supplierChNumber` ignores the `scheme` check — leaks non-GB-COH identifiers into CH matching

**File:** `src/lib/adapters/ocds.ts:111-113`
**Issue:** The `normaliseOcdsRelease` function has this logic:
```typescript
supplierChNumber: normaliseChNumber(
  supplier?.identifier?.scheme === "GB-COH"
    ? supplier.identifier.id
    : supplier?.identifier?.id,
),
```
Both branches of the ternary pass `supplier?.identifier?.id` to `normaliseChNumber`. The conditional on `scheme === "GB-COH"` is entirely dead — the else branch returns the same value as the true branch. Non-GB-COH identifiers (e.g. VAT numbers, DUNS numbers, EU scheme codes) will therefore be stored as `supplierChNumber` and used for CH-number matching. This can produce false positive firm matches when a foreign identifier accidentally matches a UK CH number format.

**Fix:** Return `null` explicitly when the scheme is not `GB-COH`:
```typescript
supplierChNumber: normaliseChNumber(
  supplier?.identifier?.scheme === "GB-COH"
    ? supplier?.identifier?.id
    : null,
),
```

---

### CR-05: `fetchFindATender` does not use `firm` parameter — fetches the full recent release feed, not firm-specific data

**File:** `src/lib/clients/find-a-tender.ts:31-68`
**Issue:** The function accepts a `Firm` parameter and the comment acknowledges "FTS does not offer a free-text supplier search on the OCDS package endpoint; we page recent release packages and let the OCDS adapter match by CH number." However, this means every `refreshFirm` call fetches up to 10 pages × 100 releases = 1,000 releases from FTS regardless of which firm is being refreshed. This is not batched across firms — each firm triggers its own independent full feed pull. With 12 firms in the seed, a full refresh of all firms would make 120 pages of FTS requests. Given the OCDS adapter filters by CH number, only a tiny fraction of fetched records match any given firm. The `firm` parameter is only used for the `term.trim()` guard (line 33), which reads `firm.canonicalName` but never uses it in any request URL. This is a correctness defect: the implementation does not match its specification, and the wasted bandwidth/requests could trigger rate-limiting or slow the dashboard to a halt.

**Fix:** Either use the FTS keyword search endpoint (`/api/1.0/ocdsReleasePackages?keyword=...`) with the firm's canonical name, or document that the full-feed strategy is intentional and throttle accordingly. At minimum, the function should filter by the firm name in the URL:
```typescript
// Use keyword parameter to scope results
let nextUrl: string | null =
  `${FTS_BASE}?limit=100&keyword=${encodeURIComponent(firm.canonicalName)}`;
```

---

## Warnings

### WR-01: `db/client.ts` module-level side effects execute in every Next.js worker — potential file system and database handle leaks

**File:** `src/db/client.ts:7-17`
**Issue:** `mkdirSync` and `new Database(dbPath)` execute at module import time with no guard. In Next.js 15 with `force-dynamic`, each serverless invocation (or hot-reload in dev) imports this module again. While `better-sqlite3` is synchronous and SQLite handles concurrent readers, the WAL pragma and multiple `Database` instances being opened without explicit `.close()` can cause handle leaks in development under rapid reload. More critically, `mkdirSync` at import time is a side effect that will fail if the process does not have write permission to the parent of `DATABASE_PATH`, with no error message distinguishing a missing env var from a permissions problem.

**Fix:** Guard the database initialisation or use a module-singleton pattern:
```typescript
// Add an explicit check before mkdirSync
const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";
if (!dbPath) throw new Error("DATABASE_PATH must be set");
```
Also consider lazy initialisation or checking whether the directory already exists before calling `mkdirSync` (the `recursive: true` flag already handles "already exists", so this is minor, but the permission failure path should produce a clear error).

---

### WR-02: `firm-form-dialog.tsx` — edit-mode state not reset when the dialog is closed via Escape or backdrop click

**File:** `src/components/firms/firm-form-dialog.tsx:98-101`
**Issue:** `resetForm()` is called when `next === false` (dialog closing), but it only clears state when `!isEditMode`. In edit mode, closing the dialog with unsaved changes (Escape, backdrop click) leaves `canonicalName`, `chNumber`, `selectedTags`, and `aliasesRaw` in their edited state. Re-opening the dialog calls `handleOpenChange(true)` which re-seeds from `firm` prop — but this relies on the caller's `firm` prop being current (passed from the server-rendered page data). If the user edited, closed without saving, then re-opens, the dialog correctly re-seeds. However, `errors` is **also** cleared in the `next && isEditMode` branch (line 97) but not in the `!next` branch for edit mode. Closing then re-opening after a validation error may leave stale error state visible momentarily.

**Fix:**
```typescript
function resetForm() {
  if (!isEditMode) {
    setCanonicalName("");
    setAliasesRaw("");
    setChNumber("");
    setSelectedTags([]);
  }
  setErrors({}); // always clear errors
}
```
The current code already calls `setErrors({})` in `resetForm()`, but `resetForm` is only called in `!next` (close) which hits `else if (!next)`. The logic is correct for errors but the comment above is about the overall flow — confirm errors are cleared on close in edit mode. Trace: `handleOpenChange(false)` → `else if (!next)` → `resetForm()` → `setErrors({})` — actually this is fine. **Downgrade concern to:** in edit mode after a failed submit, closing and reopening does not re-seed `errors` to `{}` from the `next && isEditMode` branch at line 97 because `setErrors({})` is already called. This is actually correct. Log as resolved. Keeping as WARNING for the missing fields reset in edit-mode close (canonicalName etc. remain dirty in memory between open/close cycles even though re-seeding on next open compensates).

---

### WR-03: `FirmRowActions.handleDelete` does not guard against double-click / double submission

**File:** `src/components/firms/firms-table.tsx:70-79`
**Issue:** The `handleDelete` function sets `deleting = true` synchronously, but the `AlertDialogAction` button's `disabled={deleting}` state is rendered at the time of the first click — a rapid double-click before the first render cycle with `deleting=true` can fire two concurrent `deleteFirm` calls for the same firm ID. While `deleteFirm` is idempotent (deleting a non-existent row is a no-op in Drizzle/SQLite), the second call will still hit the server action and trigger `revalidatePath`, which is unnecessary noise. More importantly, the same pattern in `TopicRowActions.handleDelete` (`topics-table.tsx:47-56`) has the same gap.

**Fix:** Add an early return guard before setting state:
```typescript
async function handleDelete() {
  if (deleting) return; // guard double-submit
  setDeleting(true);
  // ...
}
```

---

### WR-04: `http.ts` concurrency gate has a race condition — `active` counter can go negative

**File:** `src/lib/clients/http.ts:33-49`
**Issue:** The `acquire`/`release` functions use a shared module-level `active` counter without any mutex. In a single Node.js process this is safe (event loop), but the counter can go negative if `release()` is called more times than `acquire()` — which can happen if `rateLimitedFetch`'s `finally` block executes after an internal error that bypassed `acquire` (e.g. if `acquire()` itself throws). Additionally, if a waiter callback throws after `active += 1`, `release()` is never called for that slot, permanently reducing the pool by one. These are edge cases but in a server-side module with long-running procurement fetches they can silently stall all subsequent requests.

**Fix:** Use a class-based semaphore or ensure the waiter's `active += 1` is paired with a guaranteed `release()`. At minimum, document that `acquire()` must always be paired with `release()` in a `finally` block — which is already done in `rateLimitedFetch`, making this lower risk but still a latent defect.

---

### WR-05: `ocds.ts` `matchFirmToSupplier` — fuzzy name match operates on ALL suppliers in an award, not just when CH match fails

**File:** `src/lib/adapters/ocds.ts:123-145`
**Issue:** The function iterates all suppliers in the first award for both the CH-number match and the name match independently. This is correct in intent, but `canonicaliseName` strips so many legal suffixes and punctuation that very short names (e.g. "Wood", "Atkins") can match unrelated suppliers. For example, a release with supplier "Atkins Martin Ltd" would have `canonicaliseName` return `"atkinsmartin"` which would not match `"atkinsrealis"` — but "Atkins Ltd" → `"atkins"` would match `"atkins"` from firm aliases. The alias list for AtkinsRéalis includes bare `"Atkins"`, which after canonicalisation is just `"atkins"`. Any OCDS release where a supplier's name contains only the word "Atkins" would match — including contracts awarded to a wholly different firm that happens to use that word. This is a data quality defect that will produce false positive procurement records.

**Fix:** Add a minimum length guard to the canonicalised name comparison to reduce false positives:
```typescript
// Skip fuzzy match if canonicalised name is too short to be meaningful
if (supplierCanon.length < 5) continue;
if (names.some((n) => n.length >= 5 && n === supplierCanon)) return true;
```

---

### WR-06: `TopicFormDialog` — `trigger` prop is accepted in `FirmFormDialog` but not in `TopicFormDialog`, causing inconsistent API

**File:** `src/components/topics/topic-form-dialog.tsx:28-31`
**Issue:** `FirmFormDialog` accepts a `trigger` prop (line 53 of `firm-form-dialog.tsx`) that allows callers to supply a custom trigger element. `TopicFormDialog` has no such prop — its trigger is always hardcoded. Both dialogs use `DialogTrigger render={<span />}` which makes the outer `<span>` invisible and relies on `onClick={() => setOpen(true)}` on the `DialogTrigger`. However, `TopicFormDialog` ignores the custom trigger entirely — the `defaultTrigger` is always rendered and the `trigger` prop does not exist. This is inconsistent with `FirmFormDialog`'s API and will break if a caller ever needs a custom trigger for topics (e.g. empty-state CTA with different copy). This is a missing feature that will cause maintainability issues.

**Fix:** Add the `trigger` prop to `TopicFormDialog` to match `FirmFormDialog`:
```typescript
type TopicFormDialogProps = {
  topic?: Topic;
  trigger?: React.ReactNode;
};
// and in JSX: {trigger ?? defaultTrigger}
```

---

### WR-07: `seed.ts` uses `await db.select()` for idempotency check but the seed is run sequentially with individual `await db.insert()` — not wrapped in a transaction

**File:** `src/db/seed.ts:196-228`
**Issue:** If the seed script is interrupted mid-run (e.g. SIGINT, OOM), it leaves the database in a partially seeded state. On the next run, the idempotency check (`existingFirms.length > 0`) sees rows from the partial run and skips the entire seed, leaving the database with only some firms and no topics (or some topics). The `console.log("Seed complete.")` at the end is the only signal of full success, and there is no way to distinguish a partial seed from a full one without manually counting rows.

**Fix:** Wrap the entire seed in a transaction:
```typescript
await db.transaction(async (tx) => {
  for (const firm of SEED_FIRMS) {
    await tx.insert(firms).values({ ... });
  }
  for (const topic of SEED_TOPICS) {
    await tx.insert(topics).values({ ... });
  }
});
```

---

## Info

### IN-01: `TAG_STYLES` is duplicated across three files with identical content

**Files:** `src/components/firms/firms-table.tsx:45-49`, `src/components/dashboard/comparison-table.tsx:29-33`, `src/components/firms/firm-form-dialog.tsx:25-41`
**Issue:** The capability-tag colour mapping is copy-pasted with minor variations (the dialog version includes `selected`/`unselected` variants; the table version is a flat string). Any future addition of a capability tag requires updating all three files. A shared utility in `src/lib/constants.ts` or `src/components/capability-badge.tsx` would eliminate the duplication.

**Fix:** Extract to a shared file:
```typescript
// src/lib/capability-tags.ts
export const CAPABILITY_TAG_STYLES: Record<CapabilityTag, string> = {
  Nuclear: "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Construction: "bg-violet-100 text-violet-700 border-violet-200",
};
```

---

### IN-02: `ocds.test.ts` mock does not call `onConflictDoNothing` return value — `upsertProcurementRecords` return value is untested

**File:** `src/lib/adapters/ocds.test.ts:24-28`
**Issue:** The mock's `onConflictDoNothing` handler returns `undefined` (implicitly). The production code calls `await db.insert(...).values(...).onConflictDoNothing(...)` — awaiting `undefined` is safe in JS, but if the production code ever uses the return value of `onConflictDoNothing` (e.g. to check rows affected), the mock will silently return the wrong thing. The `written` counter returned by `upsertProcurementRecords` is also never asserted in the tests — the tests only check `store.size`.

**Fix:** Assert the return value in the dedup test:
```typescript
const count = await upsertProcurementRecords(FIRM, [releaseFromCF()], "contracts_finder");
expect(count).toBe(1);
```

---

### IN-03: `CapabilityTag` type is defined as a TypeScript union in `types.ts` but the Zod schema in `firm-actions.ts` independently hardcodes the same values

**Files:** `src/lib/types.ts:14`, `src/lib/actions/firm-actions.ts:22-24`
**Issue:** `CapabilityTag = "Nuclear" | "Infrastructure" | "Construction"` is defined in `types.ts`. The Zod enum in `firm-actions.ts` hardcodes the same three strings: `z.enum(["Nuclear", "Infrastructure", "Construction"])`. These two definitions are out of sync by construction — adding a new tag requires editing both files. Using `z.enum` with values derived from the TypeScript union would keep them in sync.

**Fix:**
```typescript
// In a shared constants file:
export const CAPABILITY_TAGS = ["Nuclear", "Infrastructure", "Construction"] as const;
export type CapabilityTag = typeof CAPABILITY_TAGS[number];

// In firm-actions.ts:
import { CAPABILITY_TAGS } from "@/lib/types";
capabilityTags: z.array(z.enum(CAPABILITY_TAGS)).default([]),
```

---

### IN-04: `app-sidebar.tsx` uses `BarChart3` and `Users` icons from lucide-react for placeholder items — both are unused exports that increase bundle size

**File:** `src/components/app-sidebar.tsx:8-10`
**Issue:** `BarChart3` and `Users` are imported and used only in `PLACEHOLDER_ITEMS` which renders disabled nav items. These are intentional placeholders, but the imports are real. Minor bundle weight. No defect, flagged as cleanup opportunity once placeholder items are removed.

**Fix:** No immediate action required; remove when the placeholder nav items are replaced with real routes.

---

_Reviewed: 2026-06-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
