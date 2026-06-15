import { Badge } from "@/components/ui/badge";
import { StalenessBadge } from "@/components/research/staleness-badge";
import { FindingsByTopic } from "@/components/firms/findings-by-topic";
import { CitationPanel } from "@/components/firms/citation-panel";
import { FirmRefreshAction } from "@/components/firms/firm-refresh-action";
import { FirmAnalysisRefresh } from "@/components/firms/firm-analysis-refresh";
import { ContractHistoryTable } from "@/components/firms/contract-history-table";
import { OwnershipSection } from "@/components/firms/ownership-section";
import { RiskFlagsSection } from "@/components/firms/risk-flags-section";
import { CollaborationSection } from "@/components/firms/collaboration-section";
import { FirmConflictsList } from "@/components/firms/firm-conflicts-list";
import { FirmPartnershipsList } from "@/components/firms/firm-partnerships-list";
import { CompaniesHousePanel, type CHData } from "@/components/firms/companies-house-panel";
import { cn, parseCapabilityTags } from "@/lib/utils";
import type { FirmProfile } from "@/lib/queries/firm-profile";
import type { CapabilityTag, Firm } from "@/lib/types";

// Reuse tag styles from comparison-table (UI-SPEC Color — semantic badge palette)
const TAG_STYLES: Record<CapabilityTag, string> = {
  Nuclear: "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Consultancy: "bg-violet-100 text-violet-700 border-violet-200",
};

function CapabilityBadge({ tag }: { tag: string }) {
  const style =
    TAG_STYLES[tag as CapabilityTag] ??
    "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-normal px-1.5 py-0.5 border", style)}
    >
      {tag}
    </Badge>
  );
}

type FirmProfileLayoutProps = {
  profile: FirmProfile;
  /** All firms — needed by conflict/partnership sections to resolve counterpart names. */
  allFirms: Firm[];
  chData: CHData | null;
};

/**
 * FirmProfileLayout — server component rendering the full firm profile page.
 *
 * Layout per UI-SPEC section 1:
 *   sticky header: firm name h1, capabilities section (PROF-06), staleness badge, refresh button
 *   body: findings-by-topic (left flex-1) + citation panel (right w-72)
 *   contract history: full-width below the body (PROF-03)
 *   Phase 4 cross-cutting sections (below contract history, border-t per section):
 *     - Ownership (PROF-04)
 *     - Risk Flags (PROF-05)
 *     - Collaboration History (PROF-07)
 *     - Conflicts of Interest (ANAL-01)
 *     - Known Partnerships (ANAL-02)
 */
export function FirmProfileLayout({ profile, allFirms, chData }: FirmProfileLayoutProps) {
  const {
    firm,
    findingsByTopic,
    contracts,
    ownership,
    riskFlags,
    collaboration,
    conflicts,
    partnerships,
    jvLeads,
  } = profile;

  // Parse capabilityTags JSON (raw from DB) — warns in development on invalid JSON
  const capabilityTags = parseCapabilityTags(firm.capabilityTags);

  // Determine if the firm has ever been researched (drives empty state copy)
  const isResearched = firm.lastResearchedAt !== null;

  return (
    <main className="flex flex-col min-h-full">
      {/* Sticky header per UI-SPEC section 1 */}
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <div className="flex flex-col gap-2 min-w-0">
          {/* Firm canonical name — exact DB value, no truncation (UI-SPEC Copywriting) */}
          <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
            {firm.canonicalName}
          </h1>

          {/* Capabilities section (PROF-06) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Capabilities
            </span>
            {capabilityTags.length > 0 ? (
              capabilityTags.map((tag) => (
                <CapabilityBadge key={tag} tag={tag} />
              ))
            ) : (
              <span className="text-xs text-neutral-400 italic">None</span>
            )}
          </div>
        </div>

        {/* Right side: staleness badge + refresh actions */}
        <div className="flex items-center gap-3 shrink-0">
          <StalenessBadge lastResearchedAt={firm.lastResearchedAt} />
          {isResearched && (
            <FirmAnalysisRefresh firmId={firm.id} firmName={firm.canonicalName} />
          )}
          <FirmRefreshAction firmId={firm.id} firmName={firm.canonicalName} />
        </div>
      </header>

      {/* Body: findings tabs + citation panel sidebar */}
      <div className="px-6 py-6 flex gap-6">
        <section className="flex-1 min-w-0">
          <FindingsByTopic findingsByTopic={findingsByTopic} />
        </section>

        <aside className="w-72 shrink-0">
          <CitationPanel findingsByTopic={findingsByTopic} />
        </aside>
      </div>

      {/* UK Contract History — full-width section below findings/citation row (PROF-03) */}
      <section className="px-6 pb-6">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          UK Contract History
        </h2>
        <ContractHistoryTable contracts={contracts} />
      </section>

      {/* Phase 4 cross-cutting sections */}

      {/* Ownership + Companies House — side by side, PROF-04 */}
      <div className="flex items-start">
        <div className="flex-1">
          <OwnershipSection
            ownership={ownership}
            companiesHouseNumber={firm.companiesHouseNumber}
          />
        </div>
        <div className="flex-1 border-l border-neutral-200">
          <CompaniesHousePanel chData={chData} />
        </div>
      </div>

      {/* Risk Flags — PROF-05 */}
      <RiskFlagsSection
        riskFlags={riskFlags}
        isResearched={isResearched}
      />

      {/* Collaboration History — PROF-07 */}
      <CollaborationSection
        collaboration={collaboration}
        partnerships={partnerships}
        allFirms={allFirms}
        firmId={firm.id}
        isResearched={isResearched}
        jvLeads={jvLeads}
      />

      {/* Conflicts of Interest — ANAL-01 (firm perspective) */}
      <FirmConflictsList
        conflicts={conflicts}
        firmId={firm.id}
        allFirms={allFirms}
        isResearched={isResearched}
      />

      {/* Known Partnerships — ANAL-02 (firm perspective) */}
      <FirmPartnershipsList
        partnerships={partnerships}
        firmId={firm.id}
        allFirms={allFirms}
        isResearched={isResearched}
      />
    </main>
  );
}
