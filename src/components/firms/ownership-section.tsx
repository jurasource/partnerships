import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OwnershipRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Ownership badge — green for UK, amber for foreign ISO code
// ---------------------------------------------------------------------------
function OwnershipBadge({ country }: { country: string | null }) {
  if (!country) {
    return (
      <Badge
        variant="outline"
        className="text-xs font-mono px-1.5 py-0.5 border bg-neutral-100 text-neutral-500 border-neutral-200"
      >
        Unknown
      </Badge>
    );
  }
  const isUK = country.toUpperCase() === "UK";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-mono px-1.5 py-0.5 border",
        isUK
          ? "bg-green-100 text-green-700 border-green-200"
          : "bg-amber-100 text-amber-700 border-amber-200",
      )}
    >
      {isUK ? "UK" : country.toUpperCase()}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// UK Incorporated badge
// ---------------------------------------------------------------------------
function UKIncorporatedBadge({
  ukIncorporated,
}: {
  ukIncorporated: "yes" | "no" | "unknown";
}) {
  if (ukIncorporated === "yes") {
    return (
      <Badge
        variant="outline"
        className="text-xs px-1.5 py-0.5 border bg-green-100 text-green-700 border-green-200"
      >
        Yes
      </Badge>
    );
  }
  if (ukIncorporated === "no") {
    return (
      <Badge
        variant="outline"
        className="text-xs px-1.5 py-0.5 border bg-amber-100 text-amber-700 border-amber-200"
      >
        No
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs px-1.5 py-0.5 border bg-neutral-100 text-neutral-500 border-neutral-200"
    >
      Unknown
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------
function SourceBadge({ sourceType }: { sourceType: "companies_house" | "ai_research" }) {
  const isCH = sourceType === "companies_house";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs px-1.5 py-0.5 border",
        isCH
          ? "bg-sky-50 text-sky-700 border-sky-100"
          : "bg-violet-50 text-violet-700 border-violet-100",
      )}
    >
      {isCH ? "Companies House PSC" : "AI Research"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// OwnershipSection — PROF-04
// ---------------------------------------------------------------------------
type OwnershipSectionProps = {
  ownership: OwnershipRecord | null;
  companiesHouseNumber: string | null;
};

/**
 * OwnershipSection — server component (no "use client").
 *
 * Displays: UK Incorporated, Ultimate Parent, Country of Ownership (badge),
 * Companies House Number (external link or "Not recorded"), and Source badge.
 * When pscNotTraceable === "yes", shows a not-traceable notice.
 *
 * Empty state (no ownership record): "Run research first to enable ownership analysis."
 * T-04-08: CH number interpolated into a hardcoded URL pattern only; "Not recorded"
 * when absent; rel="noopener noreferrer" on all external links.
 */
export function OwnershipSection({
  ownership,
  companiesHouseNumber,
}: OwnershipSectionProps) {
  if (!ownership) {
    return (
      <section className="px-6 py-6 border-t border-neutral-200">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Ownership</h2>
        <p className="text-sm text-neutral-500">
          Run research first to enable ownership analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="px-6 py-6 border-t border-neutral-200">
      <h2 className="text-xl font-semibold text-neutral-900 mb-4">Ownership</h2>

      <dl className="flex flex-col gap-3">
        {/* UK Incorporated */}
        <div className="flex items-center gap-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 w-44 shrink-0">
            UK Incorporated
          </dt>
          <dd>
            <UKIncorporatedBadge ukIncorporated={ownership.ukIncorporated} />
          </dd>
        </div>

        {/* Ultimate Parent */}
        <div className="flex items-center gap-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 w-44 shrink-0">
            Ultimate Parent
          </dt>
          <dd className="text-sm text-neutral-700">
            {ownership.ultimateParent ?? (
              <span className="text-neutral-500 italic">Not determinable</span>
            )}
          </dd>
        </div>

        {/* Country of Ownership */}
        <div className="flex items-center gap-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 w-44 shrink-0">
            Country of Ownership
          </dt>
          <dd>
            <OwnershipBadge country={ownership.countryOfOwnership} />
          </dd>
        </div>

        {/* Companies House Number — T-04-08: hardcoded URL pattern, alphanumeric interpolation */}
        <div className="flex items-center gap-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 w-44 shrink-0">
            Companies House Number
          </dt>
          <dd className="text-sm">
            {companiesHouseNumber ? (
              <a
                href={`https://find-and-update.company-information.service.gov.uk/company/${companiesHouseNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-blue-600 hover:underline font-mono"
              >
                {companiesHouseNumber}
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </a>
            ) : (
              <span className="text-neutral-500 italic">Not recorded</span>
            )}
          </dd>
        </div>

        {/* Source */}
        <div className="flex items-center gap-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 w-44 shrink-0">
            Source
          </dt>
          <dd>
            <SourceBadge sourceType={ownership.sourceType} />
          </dd>
        </div>
      </dl>

      {/* PSC not-traceable notice */}
      {ownership.pscNotTraceable === "yes" && (
        <p className="mt-4 text-xs text-neutral-500">
          Ultimate parent not publicly traceable via Companies House — see AI finding for context.
        </p>
      )}
    </section>
  );
}
