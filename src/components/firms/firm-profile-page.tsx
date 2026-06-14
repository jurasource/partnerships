import { Badge } from "@/components/ui/badge";
import { StalenessBadge } from "@/components/research/staleness-badge";
import { FindingsByTopic } from "@/components/firms/findings-by-topic";
import { CitationPanel } from "@/components/firms/citation-panel";
import { FirmRefreshAction } from "@/components/firms/firm-refresh-action";
import { cn } from "@/lib/utils";
import type { FirmProfile } from "@/lib/queries/firm-profile";
import type { CapabilityTag } from "@/lib/types";

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
};

/**
 * FirmProfileLayout — server component rendering the full firm profile page.
 *
 * Layout per UI-SPEC section 1:
 *   sticky header: firm name h1, capabilities section (PROF-06), staleness badge, refresh button
 *   body: findings-by-topic (left flex-1) + citation panel (right w-72)
 *   contract history: full-width below the body (PROF-03 — added in Task 3)
 */
export function FirmProfileLayout({ profile }: FirmProfileLayoutProps) {
  const { firm, findingsByTopic } = profile;

  // Parse capabilityTags JSON (raw from DB)
  let capabilityTags: string[] = [];
  try {
    capabilityTags = JSON.parse(firm.capabilityTags) as string[];
  } catch {
    capabilityTags = [];
  }

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

        {/* Right side: staleness badge + refresh action */}
        <div className="flex items-center gap-3 shrink-0">
          <StalenessBadge lastResearchedAt={firm.lastResearchedAt} />
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

      {/* Contract history section — populated in Task 3 */}
    </main>
  );
}
