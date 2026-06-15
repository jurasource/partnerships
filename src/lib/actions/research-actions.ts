"use server";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { researchQueue, crossCuttingQueue } from "@/lib/jobs/bull";
import { enqueueJob } from "@/lib/jobs/queue";

/**
 * runResearch — inserts a pending job row then pushes the job onto the Redis
 * queue for the long-running worker process to pick up.
 *
 * Returns immediately; the actual research runs asynchronously in the worker.
 * Job status is tracked in the `jobs` DB table and visible on /jobs.
 *
 * Guards (RES-01, DATA-04):
 * - Firm must exist in the DB.
 * - Firm must have a Companies House number before research is triggered.
 */
export async function runResearch(
  firmId: string,
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const [firm] = await db
    .select()
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (!firm) {
    return { ok: false, error: "Firm not found." };
  }

  if (!firm.companiesHouseNumber) {
    return {
      ok: false,
      error: "Add a Companies House number before running research.",
    };
  }

  const jobId = await enqueueJob({ firmId });

  await researchQueue.add("research-firm", { firmId, jobId });

  return { ok: true, jobId };
}

/**
 * runCrossCuttingAnalysis — enqueues a cross-cutting-only job for a firm.
 *
 * Cross-cutting analysis reads existing findings and CH data (no Tavily searches),
 * so it's much cheaper than a full research run. Use this to re-derive ownership,
 * risk flags, conflicts, and partnership records from already-researched findings.
 *
 * Guard: firm must have been researched at least once (lastResearchedAt not null).
 */
export async function runCrossCuttingAnalysis(
  firmId: string,
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const [firm] = await db
    .select()
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (!firm) {
    return { ok: false, error: "Firm not found." };
  }

  if (!firm.lastResearchedAt) {
    return {
      ok: false,
      error: "Run research first before re-running cross-cutting analysis.",
    };
  }

  const jobId = await enqueueJob({ firmId, jobType: "cross-cutting-analysis" });

  await crossCuttingQueue.add("cross-cutting", { firmId, jobId });

  return { ok: true, jobId };
}

export type BatchJobType = "research" | "analysis";

export type BatchJobResult = {
  enqueued: number;
  skipped: Array<{ firmName: string; reason: string }>;
};

/**
 * runBatchJobs — enqueues research or cross-cutting-analysis jobs for multiple firms.
 *
 * jobType "research" enqueues a full research job (which auto-triggers analysis on
 * completion). jobType "analysis" enqueues a cross-cutting-only job (cheaper; reads
 * existing findings, no Tavily searches).
 *
 * Firms that fail their precondition check are skipped and reported back rather than
 * aborting the whole batch.
 */
export async function runBatchJobs(
  firmIds: string[],
  jobType: BatchJobType,
): Promise<BatchJobResult> {
  if (firmIds.length === 0) return { enqueued: 0, skipped: [] };

  const allFirms = await db
    .select()
    .from(firms)
    .where(inArray(firms.id, firmIds));

  const firmMap = new Map(allFirms.map((f) => [f.id, f]));

  let enqueued = 0;
  const skipped: BatchJobResult["skipped"] = [];

  for (const firmId of firmIds) {
    const firm = firmMap.get(firmId);
    if (!firm) {
      skipped.push({ firmName: firmId, reason: "Firm not found" });
      continue;
    }

    if (jobType === "research") {
      if (!firm.companiesHouseNumber) {
        skipped.push({
          firmName: firm.canonicalName,
          reason: "No Companies House number",
        });
        continue;
      }
      const jobId = await enqueueJob({ firmId });
      await researchQueue.add("research-firm", { firmId, jobId });
    } else {
      if (!firm.lastResearchedAt) {
        skipped.push({
          firmName: firm.canonicalName,
          reason: "Not yet researched",
        });
        continue;
      }
      const jobId = await enqueueJob({ firmId, jobType: "cross-cutting-analysis" });
      await crossCuttingQueue.add("cross-cutting", { firmId, jobId });
    }

    enqueued++;
  }

  return { enqueued, skipped };
}
