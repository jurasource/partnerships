"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { researchQueue } from "@/lib/jobs/bull";
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
