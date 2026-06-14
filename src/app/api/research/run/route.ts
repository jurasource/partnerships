import "server-only";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { getJob, updateJobStatus } from "@/lib/jobs/queue";
import { runResearchWorker } from "@/lib/research/worker";
import { tavilyClient } from "@/lib/search/tavily";

// ---------------------------------------------------------------------------
// Request body schema — Zod-validated to prevent malformed inputs (T-02-06)
// ---------------------------------------------------------------------------
const RunRequestSchema = z.object({
  firmId: z.string().min(1),
  jobId: z.string().min(1),
});

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * POST /api/research/run
 *
 * Executes the research worker for a firm and transitions the job through
 * running → done | failed. Called fire-and-forget from the runResearch server
 * action (D-03). The caller does not await the response body.
 *
 * Threat mitigations:
 * - T-02-06: Body validated via Zod before any DB mutation
 * - T-02-05: try/catch always reaches a terminal state (done or failed — no freeze)
 * - T-02-08: Failure path does NOT roll back findings (partial retention, D-05)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate request body
  let firmId: string;
  let jobId: string;

  try {
    const body = await req.json();
    const parsed = RunRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    firmId = parsed.data.firmId;
    jobId = parsed.data.jobId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Ownership check — verify the job row exists and belongs to the supplied firmId
  // before performing any mutation. Prevents cross-firm job hijacking (T-02-09).
  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.firmId !== firmId) {
    return NextResponse.json({ error: "Job/firm mismatch" }, { status: 400 });
  }

  // Transition to running immediately so the status endpoint reflects progress
  await updateJobStatus(jobId, "running", { startedAt: nowIso() });

  try {
    // Run all 7 topics sequentially — worker handles per-topic errors internally
    // and throws only on fatal errors (network, auth, rate-limit) (AI-SPEC §4b)
    await runResearchWorker(firmId, jobId, tavilyClient);

    // Happy path: mark done and stamp lastResearchedAt (RES-07, D-07)
    await updateJobStatus(jobId, "done", { completedAt: nowIso() });
    await db
      .update(firms)
      .set({ lastResearchedAt: nowIso() })
      .where(eq(firms.id, firmId));

    revalidatePath("/firms");
    revalidatePath("/");
  } catch (err) {
    // Failure path: mark failed with error message (D-05).
    // Findings already written are RETAINED — do NOT delete them.
    const message =
      err instanceof Error ? err.message : "Unknown error during research.";
    await updateJobStatus(jobId, "failed", {
      completedAt: nowIso(),
      errorMessage: message,
    });
  }

  // Always return ok — the caller (fire-and-forget fetch) does not read the body
  return NextResponse.json({ ok: true });
}
