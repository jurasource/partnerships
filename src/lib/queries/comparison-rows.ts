import { db } from "@/db/client";
import { firms, procurementRecords, ownershipRecords } from "@/db/schema";
import type { Firm } from "@/lib/types";
import { sql } from "drizzle-orm";

/**
 * ComparisonRow — a full Firm row augmented with contractCount and ownershipCountry.
 * Returned by getComparisonRows() for the dashboard comparison table.
 */
export type ComparisonRow = Firm & {
  contractCount: number;
  /** ISO 2-letter country code, "UK", or null when no ownership record exists. */
  ownershipCountry: string | null;
};

/**
 * getComparisonRows — fetch every firm, count their matched procurement
 * records, and join ownership country, used by the dashboard comparison table.
 *
 * Strategy: three separate queries, merged in JS.
 *   1. Select all firms.
 *   2. Select firmId + COUNT(*) from procurementRecords, grouped by firmId.
 *   3. Select firmId + countryOfOwnership from ownershipRecords.
 * Join in application layer — avoids JOIN complexity and keeps each query
 * simple and independently testable.
 *
 * Contract count defaults to 0 for firms with no procurement records.
 * ownershipCountry defaults to null for firms with no ownership record.
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

  // Query 3: ownership country per firm (one row per firm due to unique index)
  const ownershipRows = await db
    .select({
      firmId: ownershipRecords.firmId,
      countryOfOwnership: ownershipRecords.countryOfOwnership,
    })
    .from(ownershipRecords);

  // Build lookup maps
  const countMap = new Map<string, number>();
  for (const row of countRows) {
    countMap.set(row.firmId, Number(row.contractCount));
  }

  const ownershipMap = new Map<string, string | null>();
  for (const row of ownershipRows) {
    ownershipMap.set(row.firmId, row.countryOfOwnership);
  }

  // Merge: every firm gets its count (default 0) and ownershipCountry (default null)
  return allFirms.map((firm) => ({
    ...firm,
    contractCount: countMap.get(firm.id) ?? 0,
    ownershipCountry: ownershipMap.has(firm.id)
      ? (ownershipMap.get(firm.id) ?? null)
      : null,
  }));
}
