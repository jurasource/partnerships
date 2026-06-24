import { NextResponse } from "next/server";

import { getSearchRecords } from "@/lib/docs";

// Full-text search records for the Documentation section. Served lazily on the
// first search so the doc content isn't shipped in the initial page payload.
export function GET() {
  return NextResponse.json(getSearchRecords());
}
