"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { enqueueJob } from "@/lib/jobs/queue";

/**
 * runResearch — fire-and-forget server action that enqueues a research job
 * and triggers the /api/research/run worker without blocking the caller (D-03).
 *
 * Returns immediately after enqueue. The worker updates job status independently
 * via the /api/research/run route handler. The caller polls /api/research/status
 * to observe progress (RES-02).
 *
 * Guards (RES-01, DATA-04):
 * - Firm must exist in the DB.
 * - Firm must have a Companies House number before research is triggered
 *   (the grounding context depends on it for entity disambiguation).
 */
export async function runResearch(
  firmId: string,
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  // Firm lookup — never trust caller-supplied data directly
  const [firm] = await db
    .select()
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (!firm) {
    return { ok: false, error: "Firm not found." };
  }

  // CH number guard (DATA-04 / UI-SPEC disabled-state copy)
  if (!firm.companiesHouseNumber) {
    return {
      ok: false,
      error: "Add a Companies House number before running research.",
    };
  }

  // Enqueue a durable job row — creates the observable state for polling
  const jobId = await enqueueJob({ firmId });

  // Fire-and-forget POST to the worker route. Do NOT await — the caller returns
  // immediately and the worker transitions the job through running → done | failed.
  // Worker failure is tracked via job status polling (AI-SPEC §4b D-03).
  fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/research/run`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmId, jobId }),
    },
  ).catch(() => {
    // Intentionally swallowed — the job stays "pending" on network failure;
    // the UI shows it as pending and the user can re-trigger.
  });

  return { ok: true, jobId };
}
