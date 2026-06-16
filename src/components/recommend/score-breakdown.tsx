"use client";

import { useState } from "react";

import type { TeamRecommendation } from "@/lib/recommend/schemas";

type ExcludedPair = {
  firmAName: string;
  firmBName: string;
  conflictType: string;
};

type ScoreBreakdownProps = {
  team: TeamRecommendation;
  excludedPairs?: ExcludedPair[];
};

export function ScoreBreakdown({ team, excludedPairs = [] }: ScoreBreakdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 transition-colors"
      >
        {open ? "Hide reasoning" : "View reasoning"}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          {/* Score table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-1.5 pr-3 text-neutral-500 font-semibold">Firm</th>
                  <th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Capability</th>
                  <th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">UK Ownership</th>
                  <th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Contracts</th>
                  <th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Risk</th>
                  <th className="text-right py-1.5 pl-2 text-neutral-500 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {team.firms.map((firm) => (
                  <tr key={firm.firmId} className="border-b border-neutral-100">
                    <td className="py-1.5 pr-3 text-neutral-700">{firm.firmName}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-neutral-600">
                      {(firm.signalScores.capabilityMatch * 100).toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-neutral-600">
                      {(firm.signalScores.ukOwnership * 100).toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-neutral-600">
                      {(firm.signalScores.contractRelevance * 100).toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-neutral-600">
                      {(firm.signalScores.riskFlags * 100).toFixed(0)}
                    </td>
                    <td className="py-1.5 pl-2 text-right font-mono text-neutral-900 font-semibold">
                      {firm.weightedTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Excluded pairs */}
          {excludedPairs.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-neutral-500">Excluded pairs:</p>
              {excludedPairs.map((pair, i) => (
                <p key={i} className="text-xs text-neutral-500">
                  {pair.firmAName} + {pair.firmBName} — {pair.conflictType}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
