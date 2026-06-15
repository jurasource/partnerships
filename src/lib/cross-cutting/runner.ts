/**
 * Cross-cutting analysis job orchestrator (ANAL-04).
 *
 * Executes four extraction passes for a firm in sequence:
 * 1. extractRiskFlags    — "Financial health" / "Regulatory approvals" / "Reputation and controversy"
 * 2. detectCoSuppliers   — shared OCDS ocid SQL query
 * 3. extractConflicts    — "Partnerships and JVs" + "Reputation and controversy" LLM extraction
 * 4. extractCollaboration — "Partnerships and JVs" culture-fit + JV pair extraction
 *
 * Ownership derivation (ukIncorporated etc.) is handled by the ch-refresh job
 * (src/lib/cross-cutting/ch-refresh-runner.ts), which runs in parallel with this
 * job after research completes.
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
    console.log(`[cross-cutting] Step 1/4: extractRiskFlags — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 1/4: Extracting risk flags");
    await extractRiskFlags(firmId);
    console.log(`[cross-cutting] Step 1/4 complete`);

    console.log(`[cross-cutting] Step 2/4: detectCoSuppliers — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 2/4: Detecting co-supplier partnerships");
    await detectCoSuppliers(firmId);
    console.log(`[cross-cutting] Step 2/4 complete`);

    console.log(`[cross-cutting] Step 3/4: extractConflicts — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 3/4: Extracting conflict pairs");
    await extractConflicts(firmId);
    console.log(`[cross-cutting] Step 3/4 complete`);

    console.log(`[cross-cutting] Step 4/4: extractCollaboration — firm "${firmName}"`);
    await updateJobProgress(jobId, "Step 4/4: Extracting collaboration record");
    await extractCollaboration(firmId);
    console.log(`[cross-cutting] Step 4/4 complete`);

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
