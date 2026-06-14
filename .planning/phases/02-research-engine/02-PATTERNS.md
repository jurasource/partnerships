# Phase 2: Research Engine - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 9 new/modified files + 2 UI components
**Analogs found:** 9 / 11 (2 route handlers have no existing analog in this codebase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/search/types.ts` | utility (interface) | request-response | `src/lib/clients/companies-house.ts` (exported types pattern) | role-match |
| `src/lib/search/tavily.ts` | service (API client) | request-response | `src/lib/clients/companies-house.ts` | exact |
| `src/app/api/research/run/route.ts` | controller (route handler) | request-response | `src/lib/actions/refresh-actions.ts` (closest logic analog) | partial — no existing route.ts in codebase |
| `src/app/api/research/status/[jobId]/route.ts` | controller (route handler) | request-response | `src/lib/jobs/queue.ts` (getJob) | partial — no existing route.ts in codebase |
| `src/db/schema.ts` | model (schema addition) | CRUD | `src/db/schema.ts` itself (existing pattern) | exact |
| `src/lib/actions/refresh-actions.ts` | service (server action, extend) | request-response | itself | exact |
| `src/components/firms/firm-row-research.tsx` (new) | component (trigger button) | event-driven | `src/components/firms/firm-row-refresh.tsx` | exact |
| `src/components/firms/research-status-badge.tsx` (new) | component (status badge) | event-driven (polling) | `src/components/ui/badge.tsx` + `firm-row-refresh.tsx` | role-match |
| `src/components/firms/firms-table.tsx` (extend) | component (table) | CRUD | itself | exact |

---

## Pattern Assignments

### `src/lib/search/types.ts` (utility, interface definitions)

**Analog:** `src/lib/types.ts` and exported type patterns from `src/lib/clients/companies-house.ts`

**Pattern — exported interface with no runtime code** (`src/lib/types.ts` lines 1–22):
```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { firms, topics } from "@/db/schema";

export type Firm = InferSelectModel<typeof firms>;
```

**What to define in `src/lib/search/types.ts`:**
```typescript
// NO "server-only" import — this is a pure type file, imported by both
// the Tavily client (server) and potentially Zod schemas.

export type WebSearchQuery = {
  query: string;
  /** Max results to return (default 5). */
  maxResults?: number;
};

export type WebSearchResult = {
  url: string;
  title: string;
  snippet: string;
};

export interface WebSearchClient {
  search(query: WebSearchQuery): Promise<WebSearchResult[]>;
}
```

---

### `src/lib/search/tavily.ts` (service, request-response)

**Analog:** `src/lib/clients/companies-house.ts`

**Imports pattern** (`src/lib/clients/companies-house.ts` lines 1–6):
```typescript
import "server-only";
import { z } from "zod";

import { rateLimitedFetch } from "./http";
```

**Env key guard pattern** (`src/lib/clients/companies-house.ts` lines 20–30):
```typescript
function authHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) {
    throw new Error(
      "COMPANIES_HOUSE_API_KEY is not set — Companies House lookups require a free API key.",
    );
  }
  const token = Buffer.from(`${key}:`).toString("base64");
  return `Basic ${token}`;
}
```

**Zod response validation pattern** (`src/lib/clients/companies-house.ts` lines 44–65):
```typescript
const CompanyProfileSchema = z
  .object({
    company_number: z.string(),
    company_name: z.string(),
    company_status: z.string().optional(),
  })
  .passthrough();

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
```

**Error handling + null-on-404 pattern** (`src/lib/clients/companies-house.ts` lines 32–41):
```typescript
async function chGet(path: string): Promise<unknown> {
  const res = await rateLimitedFetch(`${CH_BASE}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Companies House request failed (${res.status}) for ${path}`);
  }
  return res.json();
}
```

**What to copy for `src/lib/search/tavily.ts`:**
- `import "server-only"` at line 1 (mandatory — contains API key)
- Env guard function pattern (swap `COMPANIES_HOUSE_API_KEY` for `TAVILY_API_KEY`)
- `rateLimitedFetch` from `./http` — reuse for Tavily HTTP calls
- Zod schema on Tavily response body, `.passthrough()` tolerant
- Export `tavilyClient` as a `WebSearchClient` implementing the interface from `src/lib/search/types.ts`
- Base URL as hard-coded constant: `const TAVILY_BASE = "https://api.tavily.com"`

---

### `src/app/api/research/run/route.ts` (controller, request-response)

**No existing route.ts in codebase.** Closest logic analog is `src/lib/actions/refresh-actions.ts` (enqueue → run → status update loop).

**Job lifecycle pattern to copy** (`src/lib/actions/refresh-actions.ts` lines 38–88):
```typescript
export async function refreshFirm(firmId: string): Promise<RefreshFirmResult> {
  const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
  if (!firm) {
    return { ok: false, error: "Firm not found." };
  }

  const jobId = await enqueueJob({ firmId });
  await updateJobStatus(jobId, "running", { startedAt: nowIso() });

  try {
    // ... work ...
    await updateJobStatus(jobId, "done", { completedAt: nowIso() });
    return { ok: true, jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during refresh.";
    await updateJobStatus(jobId, "failed", {
      completedAt: nowIso(),
      errorMessage: message,
    });
    return { ok: false, jobId, error: message };
  }
}
```

**Next.js App Router Route Handler shape (no analog — use stack docs):**
```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  // validate body.firmId and body.jobId with Zod
  // run research loop (updates own job status)
  // return immediately — caller does not await
  return NextResponse.json({ ok: true });
}
```

**Key constraints from D-03:**
- Route receives `{ firmId, jobId }` in POST body (jobId already enqueued by server action)
- Route handler transitions job: `running → done | failed` via `updateJobStatus`
- Partial failure (D-05): on error, mark `failed` but do NOT delete findings already written
- Must start with `import "server-only"` — never called from client components directly

**Drizzle insert pattern for findings** (schema reference `src/db/schema.ts` lines 112–146):
```typescript
// All three citation fields are notNull — Zod schema on the AI output must
// enforce sourceUrl, sourceTitle, rawSnippet before attempting insert.
await db.insert(findings).values({
  firmId,
  topicId,
  summary,
  sourceUrl,
  sourceTitle,
  rawSnippet,
  confidence, // "HIGH" | "MEDIUM" — never store "LOW"
});
```

---

### `src/app/api/research/status/[jobId]/route.ts` (controller, request-response)

**No existing route.ts in codebase.** Logic delegate is `getJob` from `src/lib/jobs/queue.ts`.

**getJob pattern** (`src/lib/jobs/queue.ts` lines 47–50):
```typescript
export async function getJob(id: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row ?? null;
}
```

**Route handler shape (App Router dynamic segment):**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/queue";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
): Promise<NextResponse> {
  const job = await getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
```

**Progress counter note (D-06):** The route may optionally include a `topicsComplete` count derived from:
```sql
SELECT COUNT(DISTINCT topic_id) FROM findings
WHERE firm_id = ? AND created_at > job.started_at
```
Implemented as a Drizzle query using `countDistinct` from `drizzle-orm`.

---

### `src/db/schema.ts` — add `lastResearchedAt` to firms table (modify)

**Analog:** The existing `firms` table definition in `src/db/schema.ts` lines 5–29.

**Existing nullable text timestamp pattern** (`src/db/schema.ts` lines 106–108, jobs table):
```typescript
startedAt: text("started_at"),
completedAt: text("completed_at"),
errorMessage: text("error_message"),
```

**Addition to copy-from for `lastResearchedAt`:**
```typescript
// Add after updatedAt in the firms table definition:
lastResearchedAt: text("last_researched_at"),
```

Nullable (no `.notNull()`, no default) — matches `startedAt`/`completedAt` pattern. Set via `db.update(firms).set({ lastResearchedAt: nowIso() })` when job transitions to `done`.

**Drizzle migration:** After schema edit, run `npx drizzle-kit generate` then `npx drizzle-kit migrate`. Follow same pattern used when Phase 1 schema was built.

---

### `src/lib/actions/refresh-actions.ts` (server action, extend)

**Analog:** Itself (`src/lib/actions/refresh-actions.ts`).

**Existing action pattern to extend** (lines 1–13):
```typescript
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { enqueueJob, updateJobStatus } from "@/lib/jobs/queue";
```

**New `runResearch` action shape (fire-and-forget per D-03):**
```typescript
export async function runResearch(firmId: string): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
  if (!firm) return { ok: false, error: "Firm not found." };

  const jobId = await enqueueJob({ firmId });

  // Fire-and-forget — do NOT await. Worker updates its own job status.
  fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/research/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firmId, jobId }),
  }).catch(() => {
    // Intentionally swallowed — worker failure is tracked via job status polling.
  });

  return { ok: true, jobId };
}
```

**Error handling:** No try/catch around the fire-and-forget fetch — enqueue errors are the only synchronous failures. Match existing `{ ok, jobId, error }` return type.

---

### `src/components/firms/firm-row-research.tsx` (component, event-driven)

**Analog:** `src/components/firms/firm-row-refresh.tsx` — exact match on role (per-row action button) and data flow (triggers server action, shows loading state).

**Full pattern to copy** (`src/components/firms/firm-row-refresh.tsx` lines 1–88):

Imports pattern (lines 1–14):
```typescript
"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { refreshFirm } from "@/lib/actions/refresh-actions";
```

State + handler pattern (lines 21–58):
```typescript
const [running, setRunning] = React.useState(false);

async function handleRefresh() {
  if (running) return;
  setRunning(true);
  const toastId = toast.loading(`Refreshing ${firmName}…`, {
    description: "...",
  });
  try {
    const result = await refreshFirm(firmId);
    if (result.ok) {
      toast.success("...", { id: toastId, description: "..." });
    } else {
      toast.error("...", { id: toastId, description: result.error ?? "..." });
    }
  } catch {
    toast.error("...", { id: toastId, description: "..." });
  } finally {
    setRunning(false);
  }
}
```

**Differences for research variant:**
- Import `runResearch` from `@/lib/actions/refresh-actions` instead of `refreshFirm`
- After `result.ok`, begin polling job status at 2–3s interval (see `research-status-badge.tsx` below)
- Pass `jobId` returned from `runResearch` to the polling badge component via state

---

### `src/components/firms/research-status-badge.tsx` (component, polling)

**Analog:** `src/components/firms/firm-row-refresh.tsx` (loading state pattern) + `src/components/ui/badge.tsx` (badge rendering).

**Badge import pattern** (`src/components/firms/firms-table.tsx` lines 24–25, 51–60):
```typescript
import { Badge } from "@/components/ui/badge";

function CapabilityBadge({ tag }: { tag: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-normal px-1.5 py-0.5 border", style)}
    >
      {tag}
    </Badge>
  );
}
```

**Polling pattern (no TanStack Query in Phase 1; use setInterval):**
```typescript
"use client";
import * as React from "react";

export function ResearchStatusBadge({ jobId }: { jobId: string }) {
  const [status, setStatus] = React.useState<string>("pending");
  const [topicsComplete, setTopicsComplete] = React.useState(0);

  React.useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/research/status/${jobId}`);
      if (!res.ok) return;
      const job = await res.json();
      setStatus(job.status);
      if (job.topicsComplete !== undefined) setTopicsComplete(job.topicsComplete);
      if (job.status === "done" || job.status === "failed") {
        clearInterval(id);
      }
    }, 2500);
    return () => clearInterval(id);
  }, [jobId]);

  // Render badge with status color following TAG_STYLES pattern from firms-table.tsx
}
```

---

### `src/components/firms/firms-table.tsx` (extend, component)

**Analog:** Itself — add a column for research status / last-researched timestamp.

**Existing column definition pattern** (`src/components/firms/firms-table.tsx` lines 130–192):
```typescript
function buildColumns(): ColumnDef<Firm>[] {
  return [
    {
      accessorKey: "canonicalName",
      header: "Firm",
      cell: ({ row }) => (
        <span className="font-medium text-sm">{row.getValue("canonicalName")}</span>
      ),
    },
    // ...
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <FirmRowActions firm={row.original} />,
      enableSorting: false,
    },
  ];
}
```

**Staleness badge pattern (new column):**
- Add `lastResearchedAt` to the `Firm` type once schema migration is done (auto-inferred via `InferSelectModel`)
- Add column before `actions` using `accessorKey: "lastResearchedAt"` with a cell renderer that computes staleness (> 7 days or null → show "Stale" badge in amber)
- `FirmRowActions` will gain `FirmRowResearch` button alongside `FirmRowRefresh`

---

## Shared Patterns

### `import "server-only"` guard
**Source:** All files in `src/lib/clients/` and `src/lib/jobs/queue.ts` (line 1)
**Apply to:** `src/lib/search/tavily.ts`, `src/app/api/research/run/route.ts`, `src/app/api/research/status/[jobId]/route.ts`
```typescript
import "server-only";
```

### `"use server"` directive
**Source:** `src/lib/actions/refresh-actions.ts` (line 1), `src/lib/actions/firm-actions.ts` (line 1)
**Apply to:** Any new functions added to `src/lib/actions/refresh-actions.ts`
```typescript
"use server";
```

### `"use client"` directive
**Source:** `src/components/firms/firm-row-refresh.tsx` (line 1), `src/components/firms/firms-table.tsx` (line 1)
**Apply to:** `firm-row-research.tsx`, `research-status-badge.tsx`
```typescript
"use client";
```

### `nowIso()` utility
**Source:** `src/lib/actions/refresh-actions.ts` lines 34–36
**Apply to:** `src/app/api/research/run/route.ts` (for job timestamp transitions)
```typescript
function nowIso(): string {
  return new Date().toISOString();
}
```

### Zod validation on external API responses
**Source:** `src/lib/clients/companies-house.ts` lines 44–65
**Apply to:** `src/lib/search/tavily.ts` (validate Tavily response body), `src/app/api/research/run/route.ts` (validate AI structured output via `generateObject`)
- Use `.passthrough()` for external API responses to tolerate undocumented fields
- Use strict Zod objects (no `.passthrough()`) for AI-generated Finding output — citation fields must be enforced

### `rateLimitedFetch` reuse
**Source:** `src/lib/clients/http.ts`
**Apply to:** `src/lib/search/tavily.ts`
```typescript
import { rateLimitedFetch } from "./http";
// Note: path will be "../clients/http" from src/lib/search/
```

### Error handling: catch + partial-success pattern
**Source:** `src/lib/actions/refresh-actions.ts` lines 78–88
**Apply to:** `src/app/api/research/run/route.ts` — per-topic loop should catch individual topic errors, increment a failure counter, but continue to next topic. Only mark job `failed` after all topics attempted.
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error during refresh.";
  await updateJobStatus(jobId, "failed", {
    completedAt: nowIso(),
    errorMessage: message,
  });
  return { ok: false, jobId, error: message };
}
```

### Toast feedback from client action
**Source:** `src/components/firms/firm-row-refresh.tsx` lines 32–57
**Apply to:** `src/components/firms/firm-row-research.tsx`
```typescript
const toastId = toast.loading(`Researching ${firmName}…`, {
  description: "Running AI research loop — typically 1–3 minutes.",
});
// ... on result.ok: toast.success(...)
// ... on !result.ok: toast.error(...)
```

### Drizzle `eq` + `.limit(1)` lookup
**Source:** `src/lib/actions/refresh-actions.ts` lines 40–43, `src/lib/jobs/queue.ts` lines 47–50
**Apply to:** `src/app/api/research/run/route.ts` (firm lookup), `src/app/api/research/status/[jobId]/route.ts` (job lookup)
```typescript
const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
return row ?? null;
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/api/research/run/route.ts` | controller | request-response | No Next.js App Router route handlers exist in this codebase yet. Use Next.js 15 docs for `NextRequest`/`NextResponse` shape. Logic pattern copied from `refresh-actions.ts`. |
| `src/app/api/research/status/[jobId]/route.ts` | controller | request-response | Same as above — first route.ts files in the project. Dynamic segment `[jobId]` pattern from Next.js 15 App Router docs. |

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/db/`, `src/app/`
**Files scanned:** 17 source files
**Pattern extraction date:** 2026-06-14
