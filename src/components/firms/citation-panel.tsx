import { ExternalLink } from "lucide-react";

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

type SourceLink = {
  url: string;
  title: string;
  date?: string | null;
  cited: boolean;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatSourceDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function SourceLinkRow({ link }: { link: SourceLink }) {
  if (!isSafeUrl(link.url)) return null;

  const anchor = (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-xs underline inline-flex items-center gap-1 min-w-0",
        link.cited ? "text-blue-600" : "text-neutral-400",
      )}
    >
      <span className="truncate">{link.title || link.url}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );

  const isLong = link.url.length > 40;

  return (
    <div className="flex items-baseline gap-2 min-w-0">
      {isLong ? (
        <Tooltip>
          <TooltipTrigger render={<span className="min-w-0" />}>{anchor}</TooltipTrigger>
          <TooltipContent className="max-w-xs break-all">{link.url}</TooltipContent>
        </Tooltip>
      ) : anchor}
      {link.date && (
        <span className={cn("text-xs shrink-0", link.cited ? "text-neutral-400" : "text-neutral-300")}>
          {formatSourceDate(link.date)}
        </span>
      )}
    </div>
  );
}

/**
 * CitationPanel — sidebar listing all Tavily search results per topic section.
 *
 * Cited URLs (primary source + LLM citations) are shown in blue.
 * Uncited Tavily results are shown dimmed — returned by search but not used by the LLM.
 */
export function CitationPanel({ findingsByTopic }: CitationPanelProps) {
  const sections = findingsByTopic
    .filter(
      (entry): entry is FindingByTopic & {
        finding: NonNullable<FindingByTopic["finding"]>;
        sourceType: "structured" | "ai";
      } =>
        entry.finding !== null &&
        !entry.isNotFound &&
        !entry.isError &&
        entry.sourceType !== null,
    )
    .map((entry) => {
      const links: SourceLink[] = [];

      if (entry.sourceType === "structured") {
        // Structured findings come from CH/OCDS, not Tavily — show primary source only
        if (isSafeUrl(entry.finding.sourceUrl)) {
          links.push({
            url: entry.finding.sourceUrl,
            title: entry.finding.sourceTitle,
            date: entry.finding.sourceDate ?? null,
            cited: true,
          });
        }
      } else {
        // Build cited URL set from primary source + LLM citations
        const citedUrls = new Set<string>();
        if (isSafeUrl(entry.finding.sourceUrl)) {
          citedUrls.add(entry.finding.sourceUrl);
          links.push({
            url: entry.finding.sourceUrl,
            title: entry.finding.sourceTitle,
            date: entry.finding.sourceDate ?? null,
            cited: true,
          });
        }
        try {
          const llmCitations = JSON.parse(entry.finding.citations || "[]") as Array<{
            url: string; title: string; date?: string | null;
          }>;
          for (const c of llmCitations) {
            if (isSafeUrl(c.url) && !citedUrls.has(c.url)) {
              citedUrls.add(c.url);
              links.push({ url: c.url, title: c.title, date: c.date ?? null, cited: true });
            }
          }
        } catch { /* malformed */ }

        // Append uncited Tavily results (dimmed)
        try {
          const raw = JSON.parse(entry.finding.searchResults || "[]") as Array<{
            url: string; title: string; publishedDate?: string | null;
          }>;
          for (const r of raw) {
            if (isSafeUrl(r.url) && !citedUrls.has(r.url)) {
              links.push({
                url: r.url,
                title: r.title,
                date: r.publishedDate ?? null,
                cited: false,
              });
            }
          }
        } catch { /* malformed */ }
      }

      return { topicName: entry.topic.name, links };
    })
    .filter((s) => s.links.length > 0);

  return (
    <aside className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-700">Sources</h2>

      {sections.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">
          No sources available. Run research to populate citations.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, i) => (
            <div key={section.topicName}>
              {i > 0 && <Separator className="mb-4" />}
              <p className="text-xs font-medium text-neutral-500 mb-1.5">
                {section.topicName}
              </p>
              <div className="space-y-1.5">
                {section.links.map((link) => (
                  <SourceLinkRow key={link.url} link={link} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
