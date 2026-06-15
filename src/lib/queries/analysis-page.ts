import { db } from "@/db/client";
import { firms, firmGroups, groups, conflictPairs, partnershipPairs, ownershipRecords } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ConflictPair, FirmWithGroups, PartnershipPair, OwnershipRecord } from "@/lib/types";

export type AnalysisPageData = {
  firmsWithGroups: FirmWithGroups[];
  conflictPairs: ConflictPair[];
  partnershipPairs: PartnershipPair[];
  ownershipRecords: OwnershipRecord[];
};

export async function getAnalysisPageData(): Promise<AnalysisPageData> {
  const [allFirms, memberships, conflictPairsData, partnershipPairsData, ownershipRecordsData] =
    await Promise.all([
      db.select().from(firms),
      db
        .select({ firmId: firmGroups.firmId, groupId: groups.id, groupName: groups.name })
        .from(firmGroups)
        .innerJoin(groups, eq(firmGroups.groupId, groups.id)),
      db.select().from(conflictPairs),
      db.select().from(partnershipPairs),
      db.select().from(ownershipRecords),
    ]);

  const membershipMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of memberships) {
    const existing = membershipMap.get(row.firmId) ?? [];
    existing.push({ id: row.groupId, name: row.groupName });
    membershipMap.set(row.firmId, existing);
  }

  const firmsWithGroups: FirmWithGroups[] = allFirms.map((firm) => ({
    ...firm,
    groups: membershipMap.get(firm.id) ?? [],
  }));

  return {
    firmsWithGroups,
    conflictPairs: conflictPairsData,
    partnershipPairs: partnershipPairsData,
    ownershipRecords: ownershipRecordsData,
  };
}
