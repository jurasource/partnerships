"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Firm, ConflictPair } from "@/lib/types";

type Props = {
  allFirms: Firm[];
  conflictPairs: ConflictPair[];
};

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

export function ConflictMatrix({ allFirms, conflictPairs }: Props) {
  if (allFirms.length < 2) {
    return (
      <p className="text-sm text-neutral-500">
        Add at least two researched firms to generate a conflict matrix.
      </p>
    );
  }

  // Build conflict lookup keyed by canonical pair (firmA < firmB lexicographically)
  const conflictLookup = new Map<string, ConflictPair>();
  for (const pair of conflictPairs) {
    const key = `${pair.firmAId}:${pair.firmBId}`;
    conflictLookup.set(key, pair);
  }

  function getConflict(aId: string, bId: string): ConflictPair | undefined {
    const key =
      aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
    return conflictLookup.get(key);
  }

  const n = allFirms.length;
  // gridTemplateColumns: label column + n data columns
  const gridTemplate = `auto repeat(${n}, minmax(40px, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div
        style={{ gridTemplateColumns: gridTemplate }}
        className="inline-grid"
      >
        {/* Top-left empty corner */}
        <div className="min-w-10 min-h-10 bg-neutral-50" />

        {/* Column headers */}
        {allFirms.map((firm) => (
          <div
            key={`col-${firm.id}`}
            className="min-w-10 min-h-10 bg-neutral-50 flex items-center justify-center px-1 py-1"
          >
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Link
                  href={`/firms/${firm.id}`}
                  className="text-xs text-blue-600 hover:underline font-semibold uppercase tracking-wide text-center block"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", maxHeight: "80px" }}
                >
                  {truncate(firm.canonicalName, 16)}
                </Link>
              </TooltipTrigger>
              <TooltipContent>{firm.canonicalName}</TooltipContent>
            </Tooltip>
          </div>
        ))}

        {/* Rows */}
        {allFirms.map((rowFirm) => (
          <>
            {/* Row header */}
            <div
              key={`row-${rowFirm.id}`}
              className="min-w-10 min-h-10 bg-neutral-50 flex items-center px-2 py-1"
            >
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Link
                    href={`/firms/${rowFirm.id}`}
                    className="text-xs text-blue-600 hover:underline font-semibold uppercase tracking-wide whitespace-nowrap"
                  >
                    {truncate(rowFirm.canonicalName, 16)}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{rowFirm.canonicalName}</TooltipContent>
              </Tooltip>
            </div>

            {/* Data cells */}
            {allFirms.map((colFirm) => {
              const isDiagonal = rowFirm.id === colFirm.id;

              if (isDiagonal) {
                return (
                  <div
                    key={`cell-${rowFirm.id}-${colFirm.id}`}
                    className="min-w-10 min-h-10 bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 border border-white"
                  >
                    —
                  </div>
                );
              }

              const conflict = getConflict(rowFirm.id, colFirm.id);
              if (conflict) {
                return (
                  <div
                    key={`cell-${rowFirm.id}-${colFirm.id}`}
                    className="min-w-10 min-h-10 bg-red-50 border border-red-200 flex items-center justify-center p-1"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-1 py-0.5 border",
                        "bg-red-100 text-red-700 border-red-200",
                      )}
                    >
                      {conflict.conflictType === "audit" ? "Audit" : "Competitor"}
                    </Badge>
                  </div>
                );
              }

              return (
                <div
                  key={`cell-${rowFirm.id}-${colFirm.id}`}
                  className="min-w-10 min-h-10 bg-white border border-neutral-100"
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
