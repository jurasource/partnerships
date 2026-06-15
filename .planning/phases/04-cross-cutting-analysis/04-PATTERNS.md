# Phase 4: Cross-Cutting Analysis - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` | model | CRUD | `src/db/schema.ts` (self — extend) | exact |
| `src/lib/jobs/bull.ts` | config | event-driven | `src/lib/jobs/bull.ts` (self — extend) | exact |
| `src/lib/jobs/runner.ts` | service | event-driven | `src/lib/jobs/runner.ts` (self — extend) | exact |
| `src/lib/jobs/queue.ts` | service | CRUD | `src/lib/jobs/queue.ts` (self — extend) | exact |
| `src/lib/cross-cutting/schemas.ts` | utility | transform | `src/lib/research/schemas.ts` | exact |
| `src/lib/cross-cutting/extractor.ts` | service | transform | `src/lib/research/worker.ts` | exact |
| `src/lib/cross-cutting/co-supplier.ts` | service | CRUD | `src/lib/queries/comparison-rows.ts` | role-match |
| `src/lib/cross-cutting/runner.ts` | service | event-driven | `src/lib/jobs/runner.ts` | exact |
| `src/lib/queries/firm-profile.ts` | service | CRUD | `src/lib/queries/firm-profile.ts` (self — extend) | exact |
| `src/lib/queries/analysis-page.ts` | service | CRUD | `src/lib/queries/comparison-rows.ts` | role-match |
| `src/lib/queries/comparison-rows.ts` | service | CRUD | `src/lib/queries/comparison-rows.ts` (self — extend) | exact |
| `src/scripts/worker-process.ts` | service | event-driven | `src/scripts/worker-process.ts` (self — extend) | exact |
| `src/components/firms/ownership-section.tsx` | component | request-response | `src/components/firms/firm-profile-page.tsx` | role-match |
| `src/components/firms/risk-flags-section.tsx` | component | request-response | `src/components/firms/firm-profile-page.tsx` | role-match |
| `src/components/firms/collaboration-section.tsx` | component | request-response | `src/components/firms/firm-profile-page.tsx` | role-match |
| `src/components/firms/firm-conflicts-list.tsx` | component | request-response | `src/components/firms/firm-profile-page.tsx` | role-match |
| `src/components/firms/firm-partnerships-list.tsx` | component | request-response | `src/components/firms/firm-profile-page.tsx` | role-match |
| `src/components/analysis/conflict-matrix.tsx` | component | request-response | `src/components/dashboard/comparison-table.tsx` | partial |
| `src/components/analysis/partnership-table.tsx` | component | request-response | `src/components/dashboard/comparison-table.tsx` | exact |
| `src/components/analysis/ownership-rollup.tsx` | component | request-response | `src/components/firms/firm-profile-page.tsx` | role-match |
| `src/app/(app)/analysis/page.tsx` | route | request-response | `src/app/page.tsx` | exact |
| `src/components/app-sidebar.tsx` | component | request-response | `src/components/app-sidebar.tsx` (self — extend) | exact |

---

## Pattern Assignments

### `src/db/schema.ts` (model — extend with 5 new tables)

**Analog:** `src/db/schema.ts` (lines 1-151)

**Existing table pattern** (lines 1-2, 43-75):
```typescript
import { pgTable, text, uniqueIndex, timestamp } from "drizzle-orm/pg-core";

export const procurementRecords = pgTable(
  "procurement_records",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    firmId: text("firm_id").notNull().references(() => firms.id),
    ocid: text("ocid").notNull(),
    // ... fields
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("procurement_records_ocid_unique").on(table.ocid)],
);
```

**Jobs table pattern for new `jobType` column addition** (lines 78-102):
```typescript
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id").notNull().references(() => firms.id),
  topicId: text("topic_id").references(() => topics.id),
  status: text("status")
    .$type<"pending" | "running" | "done" | "failed">()
    .notNull()
    .default("pending"),
  // ... timestamps
  progressMessage: text("progress_message"),
  // ADD: jobType text("job_type").$type<"research" | "cross-cutting-analysis">().notNull().default("research"),
});
```

**Key constraints for Phase 4 new tables:**
- One-row-per-firm tables (`ownership_records`, `collaboration_records`): use `uniqueIndex(...).on(table.firmId)` — same as `findings_firm_topic_unique` pattern.
- Pairwise tables (`conflict_pairs`, `partnership_pairs`): use composite `uniqueIndex(...).on(table.firmAId, table.firmBId, table.conflictType)` — mirrors `procurement_records_ocid_unique` pattern.
- `risk_flags`: no composite unique — use delete-then-insert (see extractor pattern below).
- All new tables follow the `id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID())` PK convention.

---

### `src/lib/jobs/bull.ts` (config — extend with cross-cutting queue)

**Analog:** `src/lib/jobs/bull.ts` (lines 1-22)

**Full existing file to copy and extend:**
```typescript
import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? "6379"),
};

export const RESEARCH_QUEUE_NAME = "research";

export type ResearchJobPayload = {
  firmId: string;
  jobId: string;
};

export const researchQueue = new Queue<ResearchJobPayload>(RESEARCH_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});
```

**Add below existing exports — mirror exactly:**
```typescript
export const CROSS_CUTTING_QUEUE_NAME = "cross-cutting-analysis";

export type CrossCuttingJobPayload = {
  firmId: string;
  jobId: string;
};

export const crossCuttingQueue = new Queue<CrossCuttingJobPayload>(CROSS_CUTTING_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});
```

---

### `src/lib/jobs/runner.ts` (service — extend to enqueue cross-cutting job)

**Analog:** `src/lib/jobs/runner.ts` (lines 1-50)

**Existing enqueue trigger location** (lines 37-42):
```typescript
    await runResearchWorker(firmId, jobId, tavilyClient, async (msg) => {
      try {
        await updateJobProgress(jobId, msg);
      } catch { /* best-effort */ }
    });
    await updateJobStatus(jobId, "done", { completedAt: nowIso() });
    await db.update(firms).set({ lastResearchedAt: nowIso() }).where(eq(firms.id, firmId));
    // ADD HERE: enqueue cross-cutting job
```

**Pattern for enqueue after research done:**
```typescript
// After updateJobStatus(jobId, "done", ...) and lastResearchedAt update:
const ccJobId = await enqueueJob({ firmId, topicId: null });
// store jobType: "cross-cutting-analysis" in the DB job row
await crossCuttingQueue.add("cross-cutting", { firmId, jobId: ccJobId });
```

**Error handling pattern** (lines 43-49 — do NOT enqueue cross-cutting if research fails):
```typescript
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateJobStatus(jobId, "failed", {
      completedAt: nowIso(),
      errorMessage: message,
    });
    // cross-cutting enqueue intentionally omitted on failure
  }
```

---

### `src/scripts/worker-process.ts` (service — extend with second Worker)

**Analog:** `src/scripts/worker-process.ts` (lines 1-59)

**Existing Worker instantiation pattern** (lines 22-33):
```typescript
import { Worker } from "bullmq";
import { executeResearchJob } from "@/lib/jobs/runner";
import { RESEARCH_QUEUE_NAME, type ResearchJobPayload } from "@/lib/jobs/bull";

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? "6379");
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? "2");

const worker = new Worker<ResearchJobPayload>(
  RESEARCH_QUEUE_NAME,
  async (job) => {
    const { firmId, jobId } = job.data;
    console.log(`[worker] Starting job ${jobId} for firm ${firmId}`);
    await executeResearchJob(firmId, jobId);
  },
  { connection: { host: REDIS_HOST, port: REDIS_PORT }, concurrency: CONCURRENCY },
);
```

**Event listeners pattern** (lines 35-45 — replicate for crossCuttingWorker):
```typescript
worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} (db: ${job.data.jobId}) completed`);
});
worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} (db: ${job?.data?.jobId}) failed:`, err.message);
});
worker.on("error", (err) => {
  console.error("[worker] Worker error:", err.message);
});
```

**Graceful shutdown pattern** (lines 51-58 — extend to close both workers):
```typescript
async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await worker.close();
  // ADD: await crossCuttingWorker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

---

### `src/lib/cross-cutting/schemas.ts` (utility — Zod schemas for extracted records)

**Analog:** `src/lib/research/schemas.ts` (lines 1-74)

**Zod schema pattern to follow** (lines 17-50):
```typescript
import { z } from "zod";

export const FindingSchema = z.object({
  summary: z.string().min(10).describe("..."),
  confidence: z.enum(["HIGH", "MEDIUM"]).describe("..."),
  sourceUrl: z.string().min(1).describe("..."),
  sourceTitle: z.string().min(1).describe("..."),
  rawSnippet: z.string().min(1).describe("..."),
  sourceDate: z.string().nullable().optional().describe("..."),
});
export type SynthesisedFinding = z.infer<typeof FindingSchema>;
```

**Apply this pattern for each of the 5 extraction schemas:**
- `OwnershipExtractionSchema` — fields: `ukIncorporated`, `ultimateParent`, `countryOfOwnership`, `pscNotTraceable`, `sourceUrl`, `sourceTitle`, `rawSnippet`
- `RiskFlagExtractionSchema` (array item) — fields: `flagType` (enum: `"financial" | "reputational" | "regulatory"`), `severity` (enum: `"High" | "Medium" | "Low"`), `description`, `sourceUrl`, `sourceTitle`, `sourceDate`, `rawSnippet`
- `ConflictPairExtractionSchema` (array item) — fields: `otherFirmName`, `conflictType` (enum: `"audit" | "competitor"`), `evidenceSummary`, `sourceUrl`, `sourceTitle`, `rawSnippet`
- `JVPartnershipExtractionSchema` (array item) — fields: `otherFirmName`, `evidenceSummary`, `sourceUrl`, `sourceTitle`, `evidenceDate`, `rawSnippet`
- `CollaborationExtractionSchema` — fields: `cultureFitSummary`, `sourceUrl`, `sourceTitle`, `rawSnippet`

**NOT_FOUND_SENTINEL pattern** (lines 66-74) — replicate per schema with appropriate empty/null values when no evidence found (empty arrays for list schemas, null fields for singleton schemas).

**Critical:** No `"server-only"` import (Phase 2 decision, confirmed in `src/lib/research/schemas.ts` which also omits it).

---

### `src/lib/cross-cutting/extractor.ts` (service — LLM extraction pass)

**Analog:** `src/lib/research/worker.ts` (lines 1-152)

**LLM call pattern** (lines 66-76):
```typescript
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await generateText({
  model: anthropic("claude-sonnet-4-6"),
  system: EXTRACTION_SYSTEM_PROMPT,
  prompt: buildExtractionPrompt(cachedFinding.summary, cachedFinding.rawSnippet),
  output: Output.object({ schema: OwnershipExtractionSchema }),
  maxOutputTokens: 512,
  temperature: 0.1,
  maxRetries: 2,
});
```

**NoObjectGeneratedError guard pattern** (lines 88-107):
```typescript
    } catch (err) {
      if (err instanceof NoObjectGeneratedError) {
        console.error(
          `[extractor] NoObjectGeneratedError for ${firmId}/${recordType}:`,
          (err as NoObjectGeneratedError).text?.slice(0, 500),
        );
        // return empty-state record — never throw, never leave absent
      } else {
        throw err; // re-throw non-schema errors
      }
    }
```

**Drizzle upsert pattern for singleton records** (lines 130-150):
```typescript
await db.insert(ownershipRecords).values({ firmId, ...extracted })
  .onConflictDoUpdate({
    target: [ownershipRecords.firmId],
    set: { ...extracted, createdAt: new Date().toISOString() },
  });
```

**Delete-then-insert pattern for `risk_flags`** (lines 130-150 adapted):
```typescript
await db.transaction(async (tx) => {
  await tx.delete(riskFlags).where(eq(riskFlags.firmId, firmId));
  if (extractedFlags.length > 0) {
    await tx.insert(riskFlags).values(extractedFlags.map(f => ({ firmId, ...f })));
  }
});
```

**Canonical pair ordering before insert:**
```typescript
function canonicalPair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}
const [firmAId, firmBId] = canonicalPair(resolvedFirmId, counterpartFirmId);
```

**Firm name resolution before pair insert** — after LLM extraction, look up `otherFirmName` against `firms.canonicalName` and `firms.aliases`; discard unresolvable names (Pitfall 3 in RESEARCH.md).

**Imports pattern** (lines 1-11):
```typescript
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { firms, topics, findings } from "@/db/schema";
// + new cross-cutting tables
```

---

### `src/lib/cross-cutting/co-supplier.ts` (service — SQL co-supplier detection)

**Analog:** `src/lib/queries/comparison-rows.ts` (lines 1-50)

**Two-query merge pattern** (lines 26-49):
```typescript
import { db } from "@/db/client";
import { procurementRecords } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// Query 1: all ocids for the target firm
const firmOcids = await db
  .select({ ocid: procurementRecords.ocid })
  .from(procurementRecords)
  .where(eq(procurementRecords.firmId, targetFirmId));

// Query 2: all records sharing those ocids (excluding target firm)
const coSupplierRows = await db
  .select({
    ocid: procurementRecords.ocid,
    firmId: procurementRecords.firmId,
    title: procurementRecords.title,
    awardDate: procurementRecords.awardDate,
  })
  .from(procurementRecords)
  .where(inArray(procurementRecords.ocid, firmOcids.map(r => r.ocid)));

// Merge in JS: group by ocid, filter out targetFirmId rows → co-supplier pairs
```

---

### `src/lib/cross-cutting/runner.ts` (service — cross-cutting job orchestrator)

**Analog:** `src/lib/jobs/runner.ts` (lines 1-50)

**Job lifecycle pattern** (full file):
```typescript
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { getJob, updateJobProgress, updateJobStatus } from "@/lib/jobs/queue";

function nowIso(): string {
  return new Date().toISOString();
}

export async function executeCrossCuttingJob(firmId: string, jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  if (job.firmId !== firmId) throw new Error("Job/firm mismatch");

  await updateJobStatus(jobId, "running", { startedAt: nowIso() });

  try {
    // orchestrate extraction passes — call extractor.ts functions
    await updateJobProgress(jobId, "Extracting ownership record...");
    // ...
    await updateJobStatus(jobId, "done", { completedAt: nowIso() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateJobStatus(jobId, "failed", { completedAt: nowIso(), errorMessage: message });
  }
}
```

---

### `src/lib/queries/firm-profile.ts` (service — extend with cross-cutting data)

**Analog:** `src/lib/queries/firm-profile.ts` (lines 1-119)

**Parallel fetch pattern** (lines 67-79):
```typescript
const [allTopics, firmFindings, contracts] = await Promise.all([
  db.select().from(topics),
  db.select().from(findings).where(eq(findings.firmId, firmId)).orderBy(desc(findings.createdAt)),
  db.select().from(procurementRecords).where(eq(procurementRecords.firmId, firmId)).orderBy(desc(procurementRecords.awardDate)),
]);
```

**Extend to add cross-cutting queries in the same Promise.all:**
```typescript
const [allTopics, firmFindings, contracts, ownership, riskFlagRows, collaboration, firmConflicts, firmPartnerships] = await Promise.all([
  // ... existing 3 queries
  db.select().from(ownershipRecords).where(eq(ownershipRecords.firmId, firmId)).limit(1),
  db.select().from(riskFlags).where(eq(riskFlags.firmId, firmId)),
  db.select().from(collaborationRecords).where(eq(collaborationRecords.firmId, firmId)).limit(1),
  db.select().from(conflictPairs).where(or(eq(conflictPairs.firmAId, firmId), eq(conflictPairs.firmBId, firmId))),
  db.select().from(partnershipPairs).where(or(eq(partnershipPairs.firmAId, firmId), eq(partnershipPairs.firmBId, firmId))),
]);
```

**Type pattern** (lines 19-33):
```typescript
export type FirmProfile = {
  firm: Firm;
  findingsByTopic: FindingByTopic[];
  contracts: ProcurementRecord[];
  // ADD:
  ownership: OwnershipRecord | null;
  riskFlags: RiskFlag[];
  collaboration: CollaborationRecord | null;
  conflicts: ConflictPair[];
  partnerships: PartnershipPair[];
};
```

---

### `src/lib/queries/analysis-page.ts` (service — NEW query file)

**Analog:** `src/lib/queries/comparison-rows.ts` (lines 1-50)

**Query file structure pattern:**
```typescript
import { db } from "@/db/client";
import { firms, conflictPairs, partnershipPairs, ownershipRecords } from "@/db/schema";

export type AnalysisPageData = {
  allFirms: Firm[];
  conflictPairs: ConflictPair[];
  partnershipPairs: PartnershipPair[];
  ownershipRecords: OwnershipRecord[];
};

export async function getAnalysisPageData(): Promise<AnalysisPageData> {
  const [allFirms, conflicts, partnerships, ownership] = await Promise.all([
    db.select().from(firms),
    db.select().from(conflictPairs),
    db.select().from(partnershipPairs),
    db.select().from(ownershipRecords),
  ]);
  return { allFirms, conflictPairs: conflicts, partnershipPairs: partnerships, ownershipRecords: ownership };
}
```

---

### `src/lib/queries/comparison-rows.ts` (service — extend with ownership join)

**Analog:** `src/lib/queries/comparison-rows.ts` (lines 1-50)

**Extend ComparisonRow type** (line 10):
```typescript
export type ComparisonRow = Firm & {
  contractCount: number;
  ownershipCountry: string | null; // ADD: from ownership_records join
};
```

**Extend query** (lines 26-49) — add a third query and merge:
```typescript
const ownershipRows = await db
  .select({ firmId: ownershipRecords.firmId, countryOfOwnership: ownershipRecords.countryOfOwnership })
  .from(ownershipRecords);

const ownershipMap = new Map<string, string | null>();
for (const row of ownershipRows) {
  ownershipMap.set(row.firmId, row.countryOfOwnership);
}

return allFirms.map((firm) => ({
  ...firm,
  contractCount: countMap.get(firm.id) ?? 0,
  ownershipCountry: ownershipMap.get(firm.id) ?? null,
}));
```

---

### `src/app/(app)/analysis/page.tsx` (route — NEW RSC route)

**Analog:** `src/app/page.tsx` (lines 1-65)

**RSC route pattern:**
```typescript
import { getAnalysisPageData } from "@/lib/queries/analysis-page";
import { ConflictMatrix } from "@/components/analysis/conflict-matrix";
import { PartnershipTable } from "@/components/analysis/partnership-table";
import { OwnershipRollup } from "@/components/analysis/ownership-rollup";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const data = await getAnalysisPageData();

  return (
    <main className="flex flex-col min-h-full">
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Analysis
        </h1>
      </header>
      <div className="flex-1 px-6 py-6 flex flex-col gap-8">
        <OwnershipRollup ownershipRecords={data.ownershipRecords} firms={data.allFirms} />
        <ConflictMatrix firms={data.allFirms} conflictPairs={data.conflictPairs} />
        <PartnershipTable firms={data.allFirms} partnershipPairs={data.partnershipPairs} />
      </div>
    </main>
  );
}
```

---

### `src/components/app-sidebar.tsx` (component — extend NAV_ITEMS)

**Analog:** `src/components/app-sidebar.tsx` (lines 1-121)

**NAV_ITEMS array** (lines 33-38) — move "Analysis" from PLACEHOLDER_ITEMS to NAV_ITEMS:
```typescript
import { Activity, BarChart3, BookOpen, Building2, LayoutDashboard, Network, Users } from "lucide-react";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Firms", href: "/firms", icon: Building2 },
  { label: "Topics", href: "/topics", icon: BookOpen },
  { label: "Jobs", href: "/jobs", icon: Activity },
  { label: "Analysis", href: "/analysis", icon: Network }, // ADD — Network icon per CONTEXT.md
];
```

**SidebarMenuButton render prop pattern** (lines 77-87) — critical: must use `render={<Link href={item.href} />}` NOT `asChild` (Phase 1 decision, confirmed in existing code):
```typescript
<SidebarMenuButton
  isActive={isActive}
  tooltip={item.label}
  render={<Link href={item.href} className={cn(...)} />}
>
  <item.icon className={cn("h-4 w-4 shrink-0", ...)} />
  <span className="text-sm">{item.label}</span>
</SidebarMenuButton>
```

---

### `src/components/dashboard/comparison-table.tsx` (component — extend with Ownership column)

**Analog:** `src/components/dashboard/comparison-table.tsx` (lines 1-80+)

**Badge pattern to copy** (lines 43-55):
```typescript
function CapabilityBadge({ tag }: { tag: string }) {
  const style = TAG_STYLES[tag as CapabilityTag] ?? "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <Badge variant="outline" className={cn("text-xs font-normal px-1.5 py-0.5 border", style)}>
      {tag}
    </Badge>
  );
}
```

**New OwnershipBadge component (follows same Badge pattern):**
```typescript
function OwnershipBadge({ country }: { country: string | null }) {
  if (!country) return <span className="text-neutral-400 font-mono text-xs">—</span>;
  const isUK = country.toUpperCase() === "UK";
  return (
    <Badge variant="outline" className={cn(
      "text-xs font-mono px-1.5 py-0.5 border",
      isUK ? "bg-green-100 text-green-700 border-green-200"
             : "bg-amber-100 text-amber-700 border-amber-200"
    )}>
      {isUK ? "UK" : country.toUpperCase()}
    </Badge>
  );
}
```

**Column definition pattern** (lines 75-80) — add Ownership column in `columns` array:
```typescript
{
  accessorKey: "ownershipCountry",
  header: "Ownership",
  cell: ({ row }) => <OwnershipBadge country={row.original.ownershipCountry} />,
},
```

---

### `src/components/firms/ownership-section.tsx` (component — NEW profile section)

**Analog:** `src/components/firms/firm-profile-page.tsx` (lines 93-99)

**Section pattern from existing profile:**
```typescript
<section className="px-6 pb-6">
  <h2 className="text-xl font-semibold text-neutral-900 mb-4">
    UK Contract History
  </h2>
  <ContractHistoryTable contracts={contracts} />
</section>
```

**Apply same section pattern for ownership:**
```typescript
// ownership-section.tsx — server component (no "use client")
import type { OwnershipRecord } from "@/lib/types"; // or from schema inference
import { ExternalLink } from "lucide-react";

type OwnershipSectionProps = {
  ownership: OwnershipRecord | null;
  companiesHouseNumber: string | null;
};

export function OwnershipSection({ ownership, companiesHouseNumber }: OwnershipSectionProps) {
  if (!ownership) {
    return (
      <section className="px-6 pb-6">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Ownership</h2>
        <p className="text-sm text-neutral-500">Run research first to enable cross-cutting analysis.</p>
      </section>
    );
  }
  // render ownership fields + CH external link
}
```

**CH external link pattern** (from CONTEXT.md folded todo):
```tsx
{companiesHouseNumber && (
  <a
    href={`https://find-and-update.company-information.service.gov.uk/company/${companiesHouseNumber}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
  >
    {companiesHouseNumber}
    <ExternalLink className="h-3 w-3" />
  </a>
)}
```

---

### `src/components/firms/risk-flags-section.tsx` (component — NEW profile section)

**Analog:** Same section pattern as `ownership-section.tsx` above.

**Badge severity pattern** (follows `CapabilityBadge` color convention):
```typescript
const SEVERITY_STYLES = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-yellow-100 text-yellow-700 border-yellow-200",
};
```

**Empty state pattern** (per established "not found is explicit" convention):
```tsx
{riskFlags.length === 0 && (
  <p className="text-sm text-neutral-500">No risk flags detected — based on available research.</p>
)}
```

---

### `src/components/analysis/partnership-table.tsx` (component — NEW TanStack table)

**Analog:** `src/components/dashboard/comparison-table.tsx` (lines 1-80)

**Full TanStack Table imports pattern** (lines 1-16):
```typescript
"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
```

---

### `src/components/analysis/conflict-matrix.tsx` (component — CSS Grid, NOT TanStack)

**Analog:** `src/components/dashboard/comparison-table.tsx` (partial — client component pattern only)

**Client component declaration:**
```typescript
"use client";
import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
```

**Critical difference from TanStack pattern:** Use CSS Grid, not TanStack Table. Wrap in `overflow-x-auto` for viewport safety:
```tsx
<div className="overflow-x-auto">
  <div
    className="grid"
    style={{ gridTemplateColumns: `auto repeat(${firms.length}, minmax(40px, 1fr))` }}
  >
    {/* header row */}
    {/* firm rows with cells */}
  </div>
</div>
```

---

## Shared Patterns

### Empty-State Rendering
**Source:** `src/components/firms/firm-profile-page.tsx` section pattern + `src/app/page.tsx` lines 26-43
**Apply to:** All new profile sections and `/analysis` page sections

When cross-cutting data is absent (D-02: firm not yet researched):
```tsx
<p className="text-sm text-neutral-500 italic">
  Run research first to enable cross-cutting analysis.
</p>
```

When extraction found no records (explicit empty state per Phase 2 convention):
```tsx
<p className="text-sm text-neutral-500">
  No [conflicts/risk flags/partnerships] detected — based on available research.
</p>
```

### Badge Pattern
**Source:** `src/components/dashboard/comparison-table.tsx` lines 43-55 + `src/components/firms/firm-profile-page.tsx` lines 18-30
**Apply to:** OwnershipBadge, RiskFlag severity badges, conflict type badges

```typescript
<Badge
  variant="outline"
  className={cn("text-xs font-normal px-1.5 py-0.5 border", styleClass)}
>
  {label}
</Badge>
```

### RSC Route + Direct DB Read
**Source:** `src/app/page.tsx` lines 1-9 + `src/app/firms/[id]/page.tsx` lines 1-20
**Apply to:** `src/app/(app)/analysis/page.tsx`

```typescript
export const dynamic = "force-dynamic";

export default async function PageName() {
  const data = await getQueryFunction();
  // pass to client components as props
}
```

### No `"server-only"` in `src/lib/`
**Source:** Phase 2 decision documented in STATE.md, confirmed by reading `src/lib/research/schemas.ts`, `src/lib/research/worker.ts`, `src/lib/jobs/bull.ts` — none include `"server-only"`.
**Apply to:** All new `src/lib/cross-cutting/` files. Never add `import "server-only"`.

### Drizzle Parameterised Queries Only
**Source:** Every existing query file — `src/lib/queries/firm-profile.ts`, `src/lib/queries/comparison-rows.ts`, `src/lib/jobs/queue.ts`
**Apply to:** All new query code — use `eq()`, `inArray()`, `or()` from `drizzle-orm`. Never string-interpolate SQL.

### `render={<Component />}` Not `asChild`
**Source:** `src/components/app-sidebar.tsx` lines 77-86
**Apply to:** Any new shadcn component usage that needs a rendered element. Base UI components in this project use `render` prop, not `asChild`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/cross-cutting/extractor.ts` test | test | transform | No direct analog — `src/lib/research/worker.test.ts` exists but uses different mock structure; planner should specify test structure drawing from `worker.test.ts` pattern |

---

## Metadata

**Analog search scope:** `src/db/`, `src/lib/`, `src/scripts/`, `src/components/`, `src/app/`
**Files scanned:** 22 source files read directly
**Pattern extraction date:** 2026-06-15
