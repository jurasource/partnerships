import { db } from "@/db/client";
import {
  firms,
  conflictPairs,
  partnershipPairs,
  ownershipRecords,
  riskFlags,
  procurementRecords,
} from "@/db/schema";
import { scoreAndRankCombinations } from "@/lib/recommend/scorer";
import { RecommendResponseSchema } from "@/lib/recommend/schemas";
import { RecommendationResult } from "@/components/recommend/recommendation-result";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  // Load all six tables in a single Promise.all — read-only (Phase 5 invariant)
  // No db.insert / db.update / db.delete anywhere in this file.
  const [
    allFirms,
    allConflicts,
    allPartnerships,
    allOwnership,
    allRiskFlags,
    allProcurement,
  ] = await Promise.all([
    db.select().from(firms),
    db.select().from(conflictPairs),
    db.select().from(partnershipPairs),
    db.select().from(ownershipRecords),
    db.select().from(riskFlags),
    db.select().from(procurementRecords),
  ]);

  // No-data state: firms table empty (pipeline never run)
  if (allFirms.length === 0) {
    return (
      <main className="flex flex-col min-h-full">
        <header className="px-6 py-6 border-b border-neutral-200 bg-white">
          <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
            Initial Report
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Best 1+1+1 consortium from seeded 12-firm dataset.
          </p>
        </header>

        <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-neutral-100 p-4">
              <FileText className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-700 mb-2">
              No report available
            </h2>
            <p className="text-sm text-neutral-500 max-w-sm">
              Run research across all firms to generate the initial report. Go
              to Dashboard to trigger research.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Direct scorer call — no HTTP fetch to /api/recommend (RESEARCH.md §Open Questions Q2)
  const result = scoreAndRankCombinations({
    capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
    lockedFirmIds: [],
    weights: {
      contractRelevance: 25,
      ukOwnership: 25,
      partnerships: 25,
      riskFlags: 25,
    },
    firms: allFirms,
    conflicts: allConflicts,
    partnerships: allPartnerships,
    ownership: allOwnership,
    riskFlags: allRiskFlags,
    procurement: allProcurement,
  });

  // Validate scorer output against the schema (throws if contract is violated — that's a bug)
  const validatedResult = RecommendResponseSchema.parse(result);

  // No-data state: scorer returned no_valid_team (e.g. insufficient capability coverage)
  if (validatedResult.status === "no_valid_team") {
    return (
      <main className="flex flex-col min-h-full">
        <header className="px-6 py-6 border-b border-neutral-200 bg-white">
          <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
            Initial Report
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Best 1+1+1 consortium from seeded 12-firm dataset.
          </p>
        </header>

        <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-neutral-100 p-4">
              <FileText className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-700 mb-2">
              No report available
            </h2>
            <p className="text-sm text-neutral-500 max-w-sm">
              Run research across all firms to generate the initial report. Go
              to Dashboard to trigger research.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-full">
      <header className="px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Initial Report
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Best 1+1+1 consortium from seeded 12-firm dataset.
        </p>
      </header>

      <div className="px-6 py-6 max-w-3xl mx-auto w-full">
        {/* readOnly=true suppresses weight sliders, lock section, recompute button, Reset link (D-11) */}
        <RecommendationResult response={validatedResult} readOnly />
      </div>
    </main>
  );
}
