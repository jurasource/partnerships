/**
 * Cross-cutting analysis job orchestrator (ANAL-04).
 *
 * Executes all five extraction passes for a firm in sequence:
 * 1. extractOwnership    — CH PSC + "Ownership structure" finding
 * 2. extractRiskFlags    — "Financial health" / "Regulatory approvals" / "Reputation and controversy"
 * 3. detectCoSuppliers   — shared OCDS ocid SQL query
 * 4. extractConflicts    — "Partnerships and JVs" + "Reputation and controversy" LLM extraction
 * 5. extractCollaboration — "Partnerships and JVs" culture-fit + JV pair extraction
 *
 * Follows the same lifecycle as executeResearchJob (runner.ts):
 *   - pending → running → done | failed
 *   - Progress messages written before each step (for /jobs page display)
 *   - Missing findings do not fail the job (explicit empty-state per Pitfall 4)
 *   - Any error transitions the job to "failed" (T-04-07 — never leaves stuck in "running")
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { getJob, updateJobProgress, updateJobStatus } from "@/lib/jobs/queue";
import { extractOwnership } from "./ownership";
import { extractRiskFlags } from "./risk-flags";
import { detectCoSuppliers } from "./co-supplier";
import { extractConflicts } from "./conflicts";
import { extractCollaboration } from "./collaboration";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Execute the cross-cutting analysis job for a firm.
 *
 * Runs all five extraction passes in sequence, updating job progress
 * before each pass. Transitions the job to "done" on success, or "failed"
 * on any unhandled error.
 *
 * Individual extractors handle their own missing-finding cases gracefully
 * (write explicit empty-state records) — this orchestrator never needs to
 * skip a step due to absent data (Pitfall 4).
 *
 * @param firmId  ID of the firm to run cross-cutting analysis for
 * @param jobId   ID of the jobs table row for this cross-cutting job
 */
export async function executeCrossCuttingJob(
  firmId: string,
  jobId: string,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Cross-cutting job not found: ${jobId}`);
  if (job.firmId !== firmId) throw new Error("Job/firm mismatch");

  const [firm] = await db.select({ canonicalName: firms.canonicalName })
    .from(firms).where(eq(firms.id, firmId)).limit(1);
  const firmName = firm?.canonicalName ?? firmId;

  console.log(
    `[cross-cutting] Starting job ${jobId} for firm "${firmName}" (${firmId})`,
  );

  await updateJobStatus(jobId, "running", { startedAt: nowIso() });

  try {
    console.log(`[cross-cutting] Step 1/5: extractOwnership — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 1/5: Extracting ownership record");
    await extractOwnership(firmId);
    console.log(`[cross-cutting] Step 1/5 complete`);

    console.log(`[cross-cutting] Step 2/5: extractRiskFlags — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 2/5: Extracting risk flags");
    await extractRiskFlags(firmId);
    console.log(`[cross-cutting] Step 2/5 complete`);

    console.log(`[cross-cutting] Step 3/5: detectCoSuppliers — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 3/5: Detecting co-supplier partnerships");
    await detectCoSuppliers(firmId);
    console.log(`[cross-cutting] Step 3/5 complete`);

    console.log(`[cross-cutting] Step 4/5: extractConflicts — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 4/5: Extracting conflict pairs");
    await extractConflicts(firmId);
    console.log(`[cross-cutting] Step 4/5 complete`);

    console.log(`[cross-cutting] Step 5/5: extractCollaboration — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 5/5: Extracting collaboration record");
    await extractCollaboration(firmId);
    console.log(`[cross-cutting] Step 5/5 complete`);

    await updateJobStatus(jobId, "done", { completedAt: nowIso() });
    console.log(`[cross-cutting] Job ${jobId} done for firm "${firmName}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[cross-cutting] Job ${jobId} failed for firm "${firmName}": ${message}`,
      err instanceof Error ? err.stack : err,
    );
    await updateJobStatus(jobId, "failed", {
      completedAt: nowIso(),
      errorMessage: message,
    });
  }
}
