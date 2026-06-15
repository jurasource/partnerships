/**
 * Co-supplier detection via shared OCDS procurement notice (ANAL-02).
 *
 * Finds pairs of firms that were both awarded the same OCDS procurement notice
 * (shared ocid in procurement_records). This is a deterministic SQL-based signal —
 * no LLM calls are needed.
 *
 * Uses the two-query merge pattern from comparison-rows.ts:
 * 1. Query 1: all procurement_records for the target firm → extract ocids
 * 2. Query 2: all procurement_records whose ocid is in that set
 * Merge in JS, group by ocid, find counterparts (firmId != targetFirmId).
 *
 * Canonical ordering (Pitfall 2): firmAId < firmBId lexicographically,
 * enforced by canonicalPair() imported from conflicts.ts.
 *
 * Idempotent: upserts via onConflictDoUpdate on the partnership_pairs unique index
 * (firmAId, firmBId, partnershipType, sourceUrl).
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { inArray, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { procurementRecords, partnershipPairs } from "@/db/schema";
import { canonicalPair } from "./conflicts";

/**
 * Detect co-supplier partnerships for a firm by finding all procurement notices
 * (ocids) where the target firm and at least one other known firm both appear
 * as suppliers.
 *
 * Writes one partnership_pairs row per (canonical pair, ocid) found.
 * Idempotent on re-run via onConflictDoUpdate.
 *
 * @param firmId  ID of the firm to detect co-suppliers for
 */
export async function detectCoSuppliers(firmId: string): Promise<void> {
  // Query 1: all procurement records for the target firm → get their ocids
  const firmRecords = await db
    .select({
      ocid: procurementRecords.ocid,
      title: procurementRecords.title,
      awardDate: procurementRecords.awardDate,
    })
    .from(procurementRecords)
    .where(eq(procurementRecords.firmId, firmId));

  if (firmRecords.length === 0) {
    // No procurement records for this firm — no co-suppliers to detect
    return;
  }

  const ocids = [...new Set(firmRecords.map((r) => r.ocid))];

  // Query 2: all procurement records whose ocid is in the target firm's ocid set
  const allRecordsForOcids = await db
    .select({
      firmId: procurementRecords.firmId,
      ocid: procurementRecords.ocid,
      title: procurementRecords.title,
      awardDate: procurementRecords.awardDate,
    })
    .from(procurementRecords)
    .where(inArray(procurementRecords.ocid, ocids));

  // Group by ocid in JS — find ocids where another firm (counterpart) also appears
  const ocidGroups = new Map<
    string,
    { firmIds: Set<string>; title: string | null | undefined; awardDate: string | null | undefined }
  >();

  for (const record of allRecordsForOcids) {
    if (!ocidGroups.has(record.ocid)) {
      ocidGroups.set(record.ocid, {
        firmIds: new Set(),
        title: record.title,
        awardDate: record.awardDate,
      });
    }
    ocidGroups.get(record.ocid)!.firmIds.add(record.firmId);
  }

  // For each ocid that has at least 2 firms, create partnership pairs
  for (const [ocid, group] of ocidGroups.entries()) {
    for (const counterpartId of group.firmIds) {
      if (counterpartId === firmId) continue; // skip self

      const [firmAId, firmBId] = canonicalPair(firmId, counterpartId);
      const evidenceSummary = `Both firms awarded notice ${ocid}`;

      await db
        .insert(partnershipPairs)
        .values({
          firmAId,
          firmBId,
          partnershipType: "co-supplier",
          sourceType: "ocds",
          sourceUrl: ocid,
          sourceTitle: group.title ?? `Procurement notice ${ocid}`,
          evidenceSummary,
          evidenceDate: group.awardDate ?? null,
        })
        .onConflictDoUpdate({
          target: [
            partnershipPairs.firmAId,
            partnershipPairs.firmBId,
            partnershipPairs.partnershipType,
            partnershipPairs.sourceUrl,
          ],
          set: {
            evidenceSummary,
            sourceTitle: group.title ?? `Procurement notice ${ocid}`,
            evidenceDate: group.awardDate ?? null,
          },
        });
    }
  }
}
