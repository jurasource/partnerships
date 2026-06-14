import "server-only";

import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { firms, jobs } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select({
      id: jobs.id,
      firmId: jobs.firmId,
      firmName: firms.canonicalName,
      status: jobs.status,
      progressMessage: jobs.progressMessage,
      createdAt: jobs.createdAt,
      startedAt: jobs.startedAt,
      completedAt: jobs.completedAt,
      errorMessage: jobs.errorMessage,
    })
    .from(jobs)
    .leftJoin(firms, eq(jobs.firmId, firms.id))
    .orderBy(desc(jobs.createdAt))
    .limit(50);

  return NextResponse.json(rows);
}
