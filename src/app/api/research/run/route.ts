import "server-only";

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { executeResearchJob } from "@/lib/jobs/runner";

const RunRequestSchema = z.object({
  firmId: z.string().min(1),
  jobId: z.string().min(1),
});

/**
 * POST /api/research/run
 *
 * Thin HTTP wrapper around executeResearchJob. Used by the E9 test suite and
 * available for direct HTTP calls (e.g. debugging). Normal production flow
 * uses the detached child process in research-actions.ts instead.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let firmId: string;
  let jobId: string;

  try {
    const body = await req.json();
    const parsed = RunRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    firmId = parsed.data.firmId;
    jobId = parsed.data.jobId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await executeResearchJob(firmId, jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }

  revalidatePath("/firms");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
