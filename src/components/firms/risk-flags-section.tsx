import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiskFlag } from "@/lib/types";

// ---------------------------------------------------------------------------
// Severity badge — High (red), Medium (amber), Low (neutral)
// ---------------------------------------------------------------------------
const SEVERITY_STYLES: Record<RiskFlag["severity"], string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const SEVERITY_ORDER: Record<RiskFlag["severity"], number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

function SeverityBadge({ severity }: { severity: RiskFlag["severity"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal px-1.5 py-0.5 border shrink-0",
        SEVERITY_STYLES[severity],
      )}
    >
      {severity}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Format an ISO date string as "14 Jun 2026" (en-GB)
// ---------------------------------------------------------------------------
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// RiskFlagsSection — PROF-05
// ---------------------------------------------------------------------------
type RiskFlagsSectionProps = {
  riskFlags: RiskFlag[];
  isResearched: boolean;
};

/**
 * RiskFlagsSection — server component (no "use client").
 *
 * Displays risk flags sorted High → Medium → Low. Each flag shows a severity
 * badge, description, source title + date, and source URL.
 *
 * Empty state (not researched): "Run research first to enable risk flag analysis."
 * Empty state (researched, none found): "No risk flags detected — based on available research findings."
 */
export function RiskFlagsSection({ riskFlags, isResearched }: RiskFlagsSectionProps) {
  if (!isResearched) {
    return (
      <section className="px-6 py-6 border-t border-neutral-200">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Risk Flags</h2>
        <p className="text-sm text-neutral-500">
          Run research first to enable risk flag analysis.
        </p>
      </section>
    );
  }

  // Sort: High → Medium → Low
  const sorted = [...riskFlags].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <section className="px-6 py-6 border-t border-neutral-200">
      <h2 className="text-xl font-semibold text-neutral-900 mb-4">Risk Flags</h2>

      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No risk flags detected — based on available research findings.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((flag) => (
            <div
              key={flag.id}
              className="border border-neutral-200 rounded-lg p-4 flex gap-3"
            >
              <SeverityBadge severity={flag.severity} />
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900">{flag.description}</p>
                <p className="text-xs text-neutral-500">
                  {flag.sourceTitle}
                  {flag.sourceDate ? ` — ${formatDate(flag.sourceDate)}` : ""}
                </p>
                {flag.sourceUrl && flag.sourceUrl !== "not-found" && (
                  <a
                    href={flag.sourceUrl}
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
