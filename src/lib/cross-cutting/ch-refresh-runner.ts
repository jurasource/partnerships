/**
 * CH refresh job executor.
 *
 * Fetches fresh Companies House data (profile, PSC, officers) and derives
 * ownership fields (ukIncorporated, countryOfOwnership, etc.) for a firm.
 *
 * Triggered automatically after a research job completes, and can also be
 * triggered manually from the firms page, firm profile page, or jobs page.
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { getJob, updateJobProgress, updateJobStatus } from "@/lib/jobs/queue";
import { extractOwnership } from "./ownership";

function nowIso(): string {
  return new Date().toISOString();
}

export async function executeCHRefreshJob(
  firmId: string,
  jobId: string,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`CH refresh job not found: ${jobId}`);
  if (job.firmId !== firmId) throw new Error("Job/firm mismatch");

  const [firm] = await db
    .select({ canonicalName: firms.canonicalName })
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);
  const firmName = firm?.canonicalName ?? firmId;

  console.log(`[ch-refresh] Starting job ${jobId} for firm "${firmName}" (${firmId})`);
  await updateJobStatus(jobId, "running", { startedAt: nowIso() });

  try {
    await updateJobProgress(jobId, "Fetching Companies House data and deriving ownership");
    await extractOwnership(firmId);
    await updateJobStatus(jobId, "done", { completedAt: nowIso() });
    console.log(`[ch-refresh] Job ${jobId} done for firm "${firmName}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[ch-refresh] Job ${jobId} failed for firm "${firmName}": ${message}`,
      err instanceof Error ? err.stack : err,
    );
    await updateJobStatus(jobId, "failed", {
      completedAt: nowIso(),
      errorMessage: message,
    });
  }
}
