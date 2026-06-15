import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConflictPair, Firm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Conflict type badge
// ---------------------------------------------------------------------------
function ConflictTypeBadge({ conflictType }: { conflictType: ConflictPair["conflictType"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal px-1.5 py-0.5 border shrink-0",
        "bg-red-100 text-red-700 border-red-200",
      )}
    >
      {conflictType === "audit" ? "Audit" : "Competitor"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// FirmConflictsList — ANAL-01 (firm perspective)
// ---------------------------------------------------------------------------
type FirmConflictsListProps = {
  conflicts: ConflictPair[];
  firmId: string;
  /** All firms for resolving counterpart names */
  allFirms: Firm[];
  isResearched: boolean;
};

/**
 * FirmConflictsList — server component (no "use client").
 *
 * Lists conflict pairs where this firm is a participant (firmA or firmB),
 * showing the OTHER firm's name and conflict type badge.
 *
 * T-04-09: Empty state when researched includes explicit clearance disclaimer.
 *
 * Empty state (not researched): "Run research first to enable conflict detection."
 * Empty state (researched, none found): "No conflicts of interest detected — based
 *   on available research. This does not constitute a legal clearance."
 */
export function FirmConflictsList({
  conflicts,
  firmId,
  allFirms,
  isResearched,
}: FirmConflictsListProps) {
  if (!isResearched) {
    return (
      <section className="px-6 py-6 border-t border-neutral-200">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          Conflicts of Interest
        </h2>
        <p className="text-sm text-neutral-500">
          Run research first to enable conflict detection.
        </p>
      </section>
    );
  }

  const firmMap = new Map<string, Firm>(allFirms.map((f) => [f.id, f]));

  // Resolve counterpart name for each conflict
  const resolvedConflicts = conflicts.map((c) => {
    const counterpartId = c.firmAId === firmId ? c.firmBId : c.firmAId;
    const counterpart = firmMap.get(counterpartId);
    return { conflict: c, counterpartName: counterpart?.canonicalName ?? counterpartId };
  });

  return (
    <section className="px-6 py-6 border-t border-neutral-200">
      <h2 className="text-xl font-semibold text-neutral-900 mb-4">
        Conflicts of Interest
      </h2>

      {resolvedConflicts.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No conflicts of interest detected — based on available research. This does not
          constitute a legal clearance.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {resolvedConflicts.map(({ conflict, counterpartName }) => (
            <div
              key={conflict.id}
              className="border border-neutral-200 rounded-lg p-4 flex gap-3"
            >
              <ConflictTypeBadge conflictType={conflict.conflictType} />
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900">
                  {counterpartName} —{" "}
                  {conflict.conflictType === "audit"
                    ? "Audit relationship"
                    : "Direct competitor"}
                </p>
                {conflict.evidenceSummary && (
                  <p className="text-xs text-neutral-500">{conflict.evidenceSummary}</p>
                )}
                <p className="text-xs text-neutral-500">{conflict.sourceTitle}</p>
                {conflict.sourceUrl && conflict.sourceUrl !== "not-found" && (
                  <a
                    href={conflict.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-blue-600 underline"
                  >
                    Source
                    <ExternalLink className="h-3 w-3 ml-0.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
