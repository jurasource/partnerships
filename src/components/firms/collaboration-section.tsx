import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CollaborationRecord, PartnershipPair, Firm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Partnership type badge
// ---------------------------------------------------------------------------
function PartnershipTypeBadge({
  partnershipType,
}: {
  partnershipType: PartnershipPair["partnershipType"];
}) {
  const isJV = partnershipType === "jv";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal px-1.5 py-0.5 border shrink-0",
        "bg-green-50 text-green-700 border-green-100",
      )}
    >
      {isJV ? "JV" : "Co-supplier"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Source badge for collaboration record (always AI Research)
// ---------------------------------------------------------------------------
function SourceBadge({ sourceType }: { sourceType: "ai_research" }) {
  void sourceType; // always "ai_research" — kept for future extensibility
  return (
    <Badge
      variant="outline"
      className="text-xs px-1.5 py-0.5 border bg-violet-50 text-violet-700 border-violet-100"
    >
      AI Research
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// CollaborationSection — PROF-07
// ---------------------------------------------------------------------------
type CollaborationSectionProps = {
  collaboration: CollaborationRecord | null;
  partnerships: PartnershipPair[];
  /** All firms for resolving counterpart names */
  allFirms: Firm[];
  firmId: string;
  isResearched: boolean;
};

/**
 * CollaborationSection — server component (no "use client").
 *
 * Two sub-sections:
 * - "Prior joint delivery": co-supplier and JV partnerships involving this firm
 * - "Cultural fit signals": cultureFitSummary from collaboration record
 *
 * Empty state (not researched): "Run research first to enable collaboration history."
 * Empty state (researched, none found): "No collaboration history detected — based on available research."
 */
export function CollaborationSection({
  collaboration,
  partnerships,
  allFirms,
  firmId,
  isResearched,
}: CollaborationSectionProps) {
  if (!isResearched) {
    return (
      <section className="px-6 py-6 border-t border-neutral-200">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          Collaboration History
        </h2>
        <p className="text-sm text-neutral-500">
          Run research first to enable collaboration history.
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

  const hasData =
    resolvedPartnerships.length > 0 ||
    (collaboration?.cultureFitSummary && collaboration.cultureFitSummary.trim().length > 0);

  if (!hasData) {
    return (
      <section className="px-6 py-6 border-t border-neutral-200">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          Collaboration History
        </h2>
        <p className="text-sm text-neutral-500">
          No collaboration history detected — based on available research.
        </p>
      </section>
    );
  }

  return (
    <section className="px-6 py-6 border-t border-neutral-200">
      <h2 className="text-xl font-semibold text-neutral-900 mb-4">
        Collaboration History
      </h2>

      {/* Prior joint delivery */}
      {resolvedPartnerships.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">
            Prior joint delivery
          </h3>
          <div className="flex flex-col gap-2">
            {resolvedPartnerships.map(({ pair, counterpartName }) => (
              <div
                key={pair.id}
                className="border border-neutral-200 rounded-lg p-4 flex gap-3"
              >
                <PartnershipTypeBadge partnershipType={pair.partnershipType} />
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">
                    {counterpartName}
                  </p>
                  {pair.evidenceSummary && (
                    <p className="text-xs text-neutral-500">{pair.evidenceSummary}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cultural fit signals */}
      {collaboration?.cultureFitSummary && collaboration.cultureFitSummary.trim() && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">
            Cultural fit signals
          </h3>
          <div className="bg-neutral-50 rounded-md p-3 flex flex-col gap-2">
            <p className="text-sm text-neutral-700 italic">
              {collaboration.cultureFitSummary}
            </p>
            {/* Collaboration records are always from AI research */}
            {collaboration.sourceUrl !== "not-found" && (
              <SourceBadge sourceType="ai_research" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
