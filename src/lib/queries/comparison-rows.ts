import { db } from "@/db/client";
import { firms, procurementRecords } from "@/db/schema";
import type { Firm } from "@/lib/types";
import { sql } from "drizzle-orm";

/**
 * ComparisonRow — a full Firm row augmented with contractCount.
 * Returned by getComparisonRows() for the dashboard comparison table.
 */
export type ComparisonRow = Firm & {
  contractCount: number;
};

/**
 * getComparisonRows — fetch every firm and count their matched procurement
 * records, used by the dashboard comparison table (DASH-01).
 *
 * Strategy: two separate queries, merged in JS.
 *   1. Select all firms.
 *   2. Select firmId + COUNT(*) from procurementRecords, grouped by firmId.
 * Join in application layer — avoids LEFT JOIN complexity with Drizzle SQLite
 * and keeps each query simple and independently testable.
 *
 * Contract count defaults to 0 for firms with no procurement records.
 */
export async function getComparisonRows(): Promise<ComparisonRow[]> {
  // Query 1: all firms
  const allFirms = await db.select().from(firms);

  // Query 2: procurement record counts grouped by firmId
  const countRows = await db
    .select({
      firmId: procurementRecords.firmId,
      contractCount: sql<number>`count(*)`,
    })
    .from(procurementRecords)
    .groupBy(procurementRecords.firmId);

  // Build a lookup map: firmId → contractCount
  const countMap = new Map<string, number>();
  for (const row of countRows) {
    countMap.set(row.firmId, Number(row.contractCount));
  }

  // Merge: every firm gets its count (default 0)
  return allFirms.map((firm) => ({
    ...firm,
    contractCount: countMap.get(firm.id) ?? 0,
  }));
}
