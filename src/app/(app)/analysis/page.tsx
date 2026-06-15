import { getAnalysisPageData } from "@/lib/queries/analysis-page";
import { AnalysisPageClient } from "@/components/analysis/analysis-page-client";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const { firmsWithGroups, conflictPairs, partnershipPairs, ownershipRecords } =
    await getAnalysisPageData();

  return (
    <main className="flex flex-col min-h-full">
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
            Cross-Cutting Analysis
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Ownership, conflicts, and partnerships across all researched firms.
          </p>
        </div>
      </header>

      <AnalysisPageClient
        firmsWithGroups={firmsWithGroups}
        conflictPairs={conflictPairs}
        partnershipPairs={partnershipPairs}
        ownershipRecords={ownershipRecords}
      />
    </main>
  );
}
