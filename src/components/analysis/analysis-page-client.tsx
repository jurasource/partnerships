"use client";

import { Separator } from "@/components/ui/separator";
import { FirmsFilterBar } from "@/components/firms/firms-filter-bar";
import { useFirmFilters } from "@/hooks/use-firm-filters";
import { OwnershipRollup } from "@/components/analysis/ownership-rollup";
import { ConflictMatrix } from "@/components/analysis/conflict-matrix";
import { PartnershipTable } from "@/components/analysis/partnership-table";
import type { FirmWithGroups, ConflictPair, PartnershipPair, OwnershipRecord } from "@/lib/types";

const ALL_CAPABILITIES = ["Nuclear", "Infrastructure", "Consultancy"];

type Props = {
  firmsWithGroups: FirmWithGroups[];
  conflictPairs: ConflictPair[];
  partnershipPairs: PartnershipPair[];
  ownershipRecords: OwnershipRecord[];
};

export function AnalysisPageClient({
  firmsWithGroups,
  conflictPairs,
  partnershipPairs,
  ownershipRecords,
}: Props) {
  const {
    allGroups,
    selectedGroupIds,
    selectedCapabilities,
    researchStatus,
    filteredData,
    onGroupsChange,
    onCapabilitiesChange,
    onResearchStatusChange,
  } = useFirmFilters(firmsWithGroups);

  const filteredIds = new Set(filteredData.map((f) => f.id));

  const filteredConflicts = conflictPairs.filter(
    (p) => filteredIds.has(p.firmAId) && filteredIds.has(p.firmBId),
  );
  const filteredPartnerships = partnershipPairs.filter(
    (p) => filteredIds.has(p.firmAId) && filteredIds.has(p.firmBId),
  );
  const filteredOwnership = ownershipRecords.filter((r) => filteredIds.has(r.firmId));

  return (
    <div className="flex-1">
      <div className="px-6 pt-4 pb-2 border-b border-neutral-100">
        <FirmsFilterBar
          allGroups={allGroups}
          allCapabilities={ALL_CAPABILITIES}
          selectedGroupIds={selectedGroupIds}
          selectedCapabilities={selectedCapabilities}
          researchStatus={researchStatus}
          onGroupsChange={onGroupsChange}
          onCapabilitiesChange={onCapabilitiesChange}
          onResearchStatusChange={onResearchStatusChange}
        />
      </div>

      <section className="px-6 py-6" id="ownership">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Ownership</h2>
        <OwnershipRollup allFirms={filteredData} ownershipRecords={filteredOwnership} />
      </section>

      <Separator />

      <section className="px-6 py-6" id="conflicts">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          Conflicts of Interest
        </h2>
        <ConflictMatrix allFirms={filteredData} conflictPairs={filteredConflicts} />
      </section>

      <Separator />

      <section className="px-6 py-6" id="partnerships">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Partnerships</h2>
        <PartnershipTable allFirms={filteredData} partnershipPairs={filteredPartnerships} />
      </section>
    </div>
  );
}
