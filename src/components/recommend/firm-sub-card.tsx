"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FirmScoreBreakdown } from "@/lib/recommend/schemas";

// ---------------------------------------------------------------------------
// Capability tag colours — matches existing badge palette
// ---------------------------------------------------------------------------
const CAPABILITY_COLORS: Record<string, string> = {
  Nuclear: "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Consultancy: "bg-violet-100 text-violet-700 border-violet-200",
};

// ---------------------------------------------------------------------------
// Risk flag count colour by highest severity present
// ---------------------------------------------------------------------------
type RiskSeverity = "High" | "Medium" | "Low";

function riskBadgeClass(severity: RiskSeverity | null): string {
  if (severity === "High") return "bg-red-50 text-red-600 border-red-100";
  if (severity === "Medium") return "bg-amber-50 text-amber-600 border-amber-100";
  return "bg-neutral-100 text-neutral-500 border-neutral-200";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ConflictRef = {
  firmName: string;
  conflictType: string;
};

type FirmSubCardProps = {
  breakdown: FirmScoreBreakdown;
  conflictWith?: ConflictRef[];
  /** Highest severity among this firm's risk flags */
  highestRiskSeverity?: RiskSeverity | null;
};

// ---------------------------------------------------------------------------
// FirmSubCard
// ---------------------------------------------------------------------------
export function FirmSubCard({
  breakdown,
  conflictWith = [],
  highestRiskSeverity = null,
}: FirmSubCardProps) {
  const ownershipRecord = breakdown.ownershipRecord as {
    ukIncorporated: "yes" | "no" | "unknown";
    countryOfOwnership?: string | null;
  } | null;

  // Ownership badge: green "UK" when ukIncorporated === "yes", else orange ISO country code
  const isUK = ownershipRecord?.ukIncorporated === "yes";
  const isForeign = ownershipRecord?.ukIncorporated === "no";
  const countryCode = ownershipRecord?.countryOfOwnership?.toUpperCase() ?? null;

  // NSI badge: shown ONLY when foreign-owned (T-05-07: never gated on weight)
  const showNSI = isForeign;

  return (
    <Card className="bg-white border-neutral-100 p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + tag row */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-neutral-900">{breakdown.firmName}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Capability tags */}
            {breakdown.capabilityTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  "text-xs px-1.5 py-0.5 border",
                  CAPABILITY_COLORS[tag] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"
                )}
              >
                {tag}
              </Badge>
            ))}

            {/* Ownership badge */}
            {ownershipRecord ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-mono px-1.5 py-0.5 border",
                  isUK
                    ? "bg-green-50 text-green-700 border-green-100"
                    : isForeign
                      ? "bg-orange-50 text-orange-700 border-orange-100"
                      : "bg-neutral-100 text-neutral-500 border-neutral-200"
                )}
              >
                {isUK ? "UK" : (countryCode ?? "Unknown")}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs font-mono px-1.5 py-0.5 border bg-neutral-100 text-neutral-500 border-neutral-200"
              >
                Unknown
              </Badge>
            )}

            {/* NSI badge — always visible when foreign-owned (CONS-04, T-05-07) */}
            {showNSI && (
              <Badge
                variant="outline"
                className="text-xs px-1.5 py-0.5 border bg-amber-100 text-amber-700 border-amber-200"
              >
                NSI
              </Badge>
            )}
          </div>
        </div>

        {/* Right: conflict + risk badges */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Intra-team conflict badges */}
          {conflictWith.map((conflict, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-xs font-normal px-1.5 py-0.5 border bg-red-100 text-red-700 border-red-200"
              title={`Conflict with ${conflict.firmName}: ${conflict.conflictType}`}
            >
              Conflict
            </Badge>
          ))}

          {/* Risk flag count badge */}
          {breakdown.riskFlagCount > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-mono px-1.5 py-0.5 border",
                riskBadgeClass(highestRiskSeverity)
              )}
              title={`${breakdown.riskFlagCount} risk flag${breakdown.riskFlagCount === 1 ? "" : "s"}`}
            >
              {breakdown.riskFlagCount} risk
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
