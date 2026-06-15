import { Separator } from "@/components/ui/separator";
import { getAnalysisPageData } from "@/lib/queries/analysis-page";
import { OwnershipRollup } from "@/components/analysis/ownership-rollup";
import { ConflictMatrix } from "@/components/analysis/conflict-matrix";
import { PartnershipTable } from "@/components/analysis/partnership-table";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const { allFirms, conflictPairs, partnershipPairs, ownershipRecords } =
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

      <div className="flex-1">
        <section className="px-6 py-6" id="ownership">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Ownership</h2>
          <OwnershipRollup allFirms={allFirms} ownershipRecords={ownershipRecords} />
        </section>

        <Separator />

        <section className="px-6 py-6" id="conflicts">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">
            Conflicts of Interest
          </h2>
          <ConflictMatrix allFirms={allFirms} conflictPairs={conflictPairs} />
        </section>

        <Separator />

        <section className="px-6 py-6" id="partnerships">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Partnerships</h2>
          <PartnershipTable allFirms={allFirms} partnershipPairs={partnershipPairs} />
        </section>
      </div>
    </main>
  );
}
