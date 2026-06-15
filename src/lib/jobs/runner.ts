import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { enqueueJob, getJob, updateJobProgress, updateJobStatus } from "@/lib/jobs/queue";
import { crossCuttingQueue, chRefreshQueue } from "@/lib/jobs/bull";
import { runResearchWorker } from "@/lib/research/worker";
import { tavilyClient } from "@/lib/search/tavily";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Executes a research job end-to-end: pending → running → done | failed.
 *
 * Shared between the HTTP route handler (tests + direct HTTP) and the
 * standalone worker process. Has no dependency on Next.js or HTTP.
 *
 * Throws on ownership failure (job not found / firm mismatch) so the caller
 * can surface an appropriate error. Worker errors are caught internally and
 * written to the job row as status "failed" — partial findings are retained.
 */
export async function executeResearchJob(firmId: string, jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  if (job.firmId !== firmId) throw new Error("Job/firm mismatch");

  await updateJobStatus(jobId, "running", { startedAt: nowIso() });

  try {
    await runResearchWorker(firmId, jobId, tavilyClient, async (msg) => {
      try {
        await updateJobProgress(jobId, msg);
      } catch {
        // Progress updates are best-effort — don't abort the research job
      }
    });
    await updateJobStatus(jobId, "done", { completedAt: nowIso() });
    await db
      .update(firms)
      .set({ lastResearchedAt: nowIso() })
      .where(eq(firms.id, firmId));

    // Enqueue cross-cutting analysis + CH refresh jobs after successful research.
    // Both run in parallel — neither depends on the other's output.
    // Only enqueued on success, not on failure.
    const ccJobId = await enqueueJob({ firmId, jobType: "cross-cutting-analysis" });
    await crossCuttingQueue.add("cross-cutting", { firmId, jobId: ccJobId });

    const chJobId = await enqueueJob({ firmId, jobType: "ch-refresh" });
    await chRefreshQueue.add("ch-refresh", { firmId, jobId: chJobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[runner] Job ${jobId} for firm ${firmId} failed: ${message}`,
      err instanceof Error ? err.stack : err,
    );
    await updateJobStatus(jobId, "failed", {
      completedAt: nowIso(),
      errorMessage: message,
    });
  }
}
