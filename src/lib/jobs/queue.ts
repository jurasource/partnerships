import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { jobs } from "@/db/schema";

/**
 * SQLite-backed job queue skeleton (D-07, D-08).
 *
 * Jobs are durable rows in the `jobs` table — they survive dev-server restarts,
 * so status is always queryable. This is the enqueue/claim/status contract Phase 2's
 * research worker will claim against (ARCHITECTURE Decision 1). Phase 1 only
 * implements enqueue/status transitions — NO AI research worker here.
 *
 * Status lifecycle (D-08): pending → running → done | failed.
 */

export type JobStatus = "pending" | "running" | "done" | "failed";

export type EnqueueJobInput = {
  firmId: string;
  /** NULL = "run all topics for this firm" (D-08). */
  topicId?: string | null;
  /**
   * Type of job to enqueue (D-12).
   * "research"                = standard Phase 2 firm research job (default)
   * "cross-cutting-analysis"  = Phase 4 derived-record extraction job
   */
  jobType?: "research" | "cross-cutting-analysis";
};

export type JobStatusUpdate = {
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
};

/** Insert a pending job row and return its id. */
export async function enqueueJob(input: EnqueueJobInput): Promise<string> {
  const [row] = await db
    .insert(jobs)
    .values({
      firmId: input.firmId,
      topicId: input.topicId ?? null,
      status: "pending",
      jobType: input.jobType ?? "research",
    })
    .returning({ id: jobs.id });

  return row.id;
}

/** Return the current job row (status + timestamps) or null if not found. */
export async function getJob(id: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row ?? null;
}

/** Update the human-readable progress message shown in the jobs UI. */
export async function updateJobProgress(id: string, message: string): Promise<void> {
  await db.update(jobs).set({ progressMessage: message }).where(eq(jobs.id, id));
}

/**
 * Transition a job's status (pending→running→done/failed, D-08), optionally
 * recording started/completed timestamps and an error message on failure.
 */
export async function updateJobStatus(
  id: string,
  status: JobStatus,
  fields: JobStatusUpdate = {},
): Promise<void> {
  await db
    .update(jobs)
    .set({
      status,
      ...(fields.startedAt !== undefined ? { startedAt: fields.startedAt } : {}),
      ...(fields.completedAt !== undefined ? { completedAt: fields.completedAt } : {}),
      ...(fields.errorMessage !== undefined ? { errorMessage: fields.errorMessage } : {}),
    })
    .where(eq(jobs.id, id));
}
