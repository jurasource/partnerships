import "server-only";

import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { firms } from "@/db/schema";

export type FirmListItem = {
  id: string;
  canonicalName: string;
  companiesHouseNumber: string | null;
  lastResearchedAt: string | null;
};

export async function GET() {
  const rows = await db
    .select({
      id: firms.id,
      canonicalName: firms.canonicalName,
      companiesHouseNumber: firms.companiesHouseNumber,
      lastResearchedAt: firms.lastResearchedAt,
    })
    .from(firms)
    .orderBy(asc(firms.canonicalName));

  return NextResponse.json(rows);
}
