import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PartnershipPair, Firm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Partnership type badge
// ---------------------------------------------------------------------------
function PartnershipTypeBadge({
  partnershipType,
}: {
  partnershipType: PartnershipPair["partnershipType"];
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal px-1.5 py-0.5 border shrink-0",
        "bg-green-50 text-green-700 border-green-100",
      )}
    >
      {partnershipType === "jv" ? "JV" : "Co-supplier"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// FirmPartnershipsList — ANAL-02 (firm perspective)
// ---------------------------------------------------------------------------
type FirmPartnershipsListProps = {
  partnerships: PartnershipPair[];
  firmId: string;
  /** All firms for resolving counterpart names */
  allFirms: Firm[];
  isResearched: boolean;
};

/**
 * FirmPartnershipsList — server component (no "use client").
 *
 * Lists partnership pairs where this firm is a participant (firmA or firmB),
 * showing the OTHER firm's name and partnership type badge.
 *
 * Empty state (not researched): "Run research first to enable partnership detection."
 * Empty state (researched, none found): "No partnership evidence found for this firm."
 */
export function FirmPartnershipsList({
  partnerships,
  firmId,
  allFirms,
  isResearched,
}: FirmPartnershipsListProps) {
  if (!isResearched) {
    return (
      <section className="px-6 py-6 border-t border-neutral-200">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          Known Partnerships
        </h2>
        <p className="text-sm text-neutral-500">
          Run research first to enable partnership detection.
        </p>
      </section>
    );
  }

  const firmMap = new Map<string, Firm>(allFirms.map((f) => [f.id, f]));

  // Resolve counterpart name for each partnership
  const resolvedPartnerships = partnerships.map((p) => {
    const counterpartId = p.firmAId === firmId ? p.firmBId : p.firmAId;
    const counterpart = firmMap.get(counterpartId);
    return { pair: p, counterpartName: counterpart?.canonicalName ?? counterpartId };
  });

  return (
    <section className="px-6 py-6 border-t border-neutral-200">
      <h2 className="text-xl font-semibold text-neutral-900 mb-4">
        Known Partnerships
      </h2>

      {resolvedPartnerships.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No partnership evidence found for this firm.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {resolvedPartnerships.map(({ pair, counterpartName }) => (
            <div
              key={pair.id}
              className="border border-neutral-200 rounded-lg p-4 flex gap-3"
            >
              <PartnershipTypeBadge partnershipType={pair.partnershipType} />
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900">{counterpartName}</p>
                {pair.evidenceSummary && (
                  <p className="text-xs text-neutral-500">{pair.evidenceSummary}</p>
                )}
                {pair.sourceUrl && pair.sourceUrl !== "not-found" && (
                  <a
                    href={pair.sourceUrl}
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
