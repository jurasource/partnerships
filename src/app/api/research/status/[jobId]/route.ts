import "server-only";

import { and, countDistinct, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { findings } from "@/db/schema";
import { getJob } from "@/lib/jobs/queue";

/**
 * GET /api/research/status/[jobId]
 *
 * Returns the job row plus a derived "N/7 topics complete" count for client
 * polling (RES-02, D-06). The count is derived at read time:
 *   COUNT(DISTINCT topicId) FROM findings WHERE firmId = ? AND createdAt > job.startedAt
 *
 * Threat mitigation (T-02-07): single-user local tool, no auth surface;
 * endpoint returns only the job row + a count — no sensitive data exposure.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  // In Next.js 16 App Router, params is a Promise — must be awaited
  const { jobId } = await params;

  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Derive "N topics complete" from findings written since this job started.
  // Guard: if startedAt is null (job still pending), count is 0.
  let topicsComplete = 0;

  if (job.startedAt) {
    const [row] = await db
      .select({ count: countDistinct(findings.topicId) })
      .from(findings)
      .where(
        and(
          eq(findings.firmId, job.firmId),
          gte(findings.createdAt, job.startedAt),
        ),
      );

    topicsComplete = row?.count ?? 0;
  }

  return NextResponse.json({
    ...job,
    topicsComplete,
    topicsTotal: 7,
  });
}
