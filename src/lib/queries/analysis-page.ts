import { db } from "@/db/client";
import { firms, conflictPairs, partnershipPairs, ownershipRecords } from "@/db/schema";
import type { Firm, ConflictPair, PartnershipPair, OwnershipRecord } from "@/lib/types";

export type AnalysisPageData = {
  allFirms: Firm[];
  conflictPairs: ConflictPair[];
  partnershipPairs: PartnershipPair[];
  ownershipRecords: OwnershipRecord[];
};

export async function getAnalysisPageData(): Promise<AnalysisPageData> {
  const [allFirms, conflictPairsData, partnershipPairsData, ownershipRecordsData] =
    await Promise.all([
      db.select().from(firms),
      db.select().from(conflictPairs),
      db.select().from(partnershipPairs),
      db.select().from(ownershipRecords),
    ]);

  return {
    allFirms,
    conflictPairs: conflictPairsData,
    partnershipPairs: partnershipPairsData,
    ownershipRecords: ownershipRecordsData,
  };
}
