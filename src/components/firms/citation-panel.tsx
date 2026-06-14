import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, isSafeUrl } from "@/lib/utils";
import type { FindingByTopic } from "@/lib/queries/firm-profile";

type CitationPanelProps = {
  findingsByTopic: FindingByTopic[];
};

type CitationEntry = {
  sourceUrl: string;
  sourceTitle: string;
  sourceType: "structured" | "ai";
  topicName: string;
};

/**
 * Truncate a URL to 40 characters for display (full URL in Tooltip).
 */
function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 1) + "…";
}

/**
 * SourceTypeBadge — "Verified API" or "AI Research" badge per citation entry.
 *
 * Classes per UI-SPEC Color section (PROF-02):
 *   Verified API → bg-sky-50 text-sky-700 border-sky-100
 *   AI Research  → bg-violet-50 text-violet-700 border-violet-100
 */
function CitationBadge({ sourceType }: { sourceType: "structured" | "ai" }) {
  if (sourceType === "structured") {
    return (
      <Badge
        variant="outline"
        className="text-xs px-1.5 py-0.5 border bg-sky-50 text-sky-700 border-sky-100 shrink-0"
      >
        Verified API
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs px-1.5 py-0.5 border bg-violet-50 text-violet-700 border-violet-100 shrink-0"
    >
      AI Research
    </Badge>
  );
}

/**
 * CitationPanel — sidebar listing all real sources grouped by source type.
 *
 * Groups structured (Verified API) entries first, then AI Research entries,
 * separated by a Separator (PROF-02 ordering).
 *
 * Null findings and not-found sentinels are excluded (no real source URL).
 * Citation links carry rel="noopener noreferrer" + target="_blank" (T-03-03).
 */
export function CitationPanel({ findingsByTopic }: CitationPanelProps) {
  // Build flat list — skip null findings and not-found sentinels
  const entries: CitationEntry[] = findingsByTopic
    .filter(
      (entry): entry is FindingByTopic & { finding: NonNullable<FindingByTopic["finding"]>; sourceType: "structured" | "ai" } =>
        entry.finding !== null &&
        !entry.isNotFound &&
        entry.sourceType !== null,
    )
    .map((entry) => ({
      sourceUrl: entry.finding.sourceUrl,
      sourceTitle: entry.finding.sourceTitle,
      sourceType: entry.sourceType,
      topicName: entry.topic.name,
    }));

  // Group: structured first, ai second (PROF-02)
  const structuredEntries = entries.filter(e => e.sourceType === "structured");
  const aiEntries = entries.filter(e => e.sourceType === "ai");

  return (
    <aside className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-700">Sources</h2>

      {entries.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">
          No sources available. Run research to populate citations.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Structured / Verified API entries */}
          {structuredEntries.map((entry) => (
            <CitationEntry key={`${entry.topicName}::${entry.sourceUrl}`} entry={entry} />
          ))}

          {/* Separator between source types (only when both groups have entries) */}
          {structuredEntries.length > 0 && aiEntries.length > 0 && (
            <Separator className="my-2" />
          )}

          {/* AI Research entries */}
          {aiEntries.map((entry) => (
            <CitationEntry key={`${entry.topicName}::${entry.sourceUrl}`} entry={entry} />
          ))}
        </div>
      )}
    </aside>
  );
}

function CitationEntry({ entry }: { entry: CitationEntry }) {
  const displayUrl = truncateUrl(entry.sourceUrl);
  const isLong = entry.sourceUrl.length > 40;
  const safeUrl = isSafeUrl(entry.sourceUrl);

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1.5 flex-wrap">
        <CitationBadge sourceType={entry.sourceType} />
        <span className="text-xs text-neutral-500">{entry.topicName}</span>
      </div>

      {safeUrl && (isLong ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 underline truncate max-w-full"
              />
            }
          >
            {displayUrl}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs break-all">
            {entry.sourceUrl}
          </TooltipContent>
        </Tooltip>
      ) : (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-blue-600 underline truncate"
        >
          {displayUrl}
        </a>
      ))}
    </div>
  );
}
