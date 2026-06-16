"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { isSafeUrl } from "@/lib/utils";
import type { FindingByTopic } from "@/lib/queries/firm-profile";
import type { Citation } from "@/lib/research/schemas";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatSourceDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function parseCitations(raw: string): Citation[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type FindingsByTopicProps = {
  findingsByTopic: FindingByTopic[];
};

function SourceTypeBadge({ sourceType }: { sourceType: "structured" | "ai" }) {
  if (sourceType === "structured") {
    return (
      <Badge
        variant="outline"
        className="text-xs px-1.5 py-0.5 border bg-sky-50 text-sky-700 border-sky-100"
      >
        Verified API
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs px-1.5 py-0.5 border bg-violet-50 text-violet-700 border-violet-100"
    >
      AI Research
    </Badge>
  );
}

export function FindingsByTopic({ findingsByTopic }: FindingsByTopicProps) {
  if (findingsByTopic.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">
          No findings yet
        </h2>
        <p className="text-sm text-neutral-500">
          Research hasn&apos;t run for this firm. Use Refresh Research to generate findings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {findingsByTopic.map((entry) => (
        <section
          key={entry.topic.id}
          className="border border-neutral-200 rounded-lg p-5 bg-white"
        >
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              {entry.topic.name}
            </h3>
            {entry.sourceType !== null && !entry.isNotFound && !entry.isError && (
              <SourceTypeBadge sourceType={entry.sourceType} />
            )}
          </div>

          {entry.finding === null ? (
            <p className="text-sm text-neutral-400 italic">
              No findings yet — run Refresh Research to populate.
            </p>
          ) : entry.isError ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-neutral-600">
                Research failed for this topic.
              </p>
              <p className="text-sm text-neutral-500">
                Failed to process the AI response. Try refreshing research for this firm, or contact support if the issue persists.
              </p>
            </div>
          ) : entry.isNotFound ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-neutral-600">
                Nothing found for this topic.
              </p>
              <p className="text-sm text-neutral-500">
                {entry.finding.summary.startsWith("Not found:")
                  ? entry.finding.summary.slice("Not found:".length).trim()
                  : entry.finding.summary}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-700 leading-relaxed">
                {entry.finding.summary}
              </p>
              {entry.sourceType !== null && (() => {
                const citations = parseCitations(entry.finding.citations);
                // Build deduplicated source list: primary first, then additional citations
                // whose URL wasn't already shown as the primary source.
                const primaryUrl = isSafeUrl(entry.finding.sourceUrl)
                  ? entry.finding.sourceUrl
                  : null;
                const additionalCitations = citations.filter(
                  (c) => isSafeUrl(c.url) && c.url !== primaryUrl,
                );

                return (
                  <div className="space-y-1">
                    {primaryUrl && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline text-xs inline-flex items-center gap-1"
                        >
                          {entry.finding.sourceTitle || "Source"}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                        {entry.finding.sourceDate && (
                          <span className="text-xs text-neutral-400">
                            {formatSourceDate(entry.finding.sourceDate)}
                          </span>
                        )}
                      </div>
                    )}
                    {additionalCitations.map((c) => (
                      <div key={c.url} className="flex items-center gap-2 flex-wrap">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline text-xs inline-flex items-center gap-1"
                        >
                          {c.title || "Source"}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                        {c.date && (
                          <span className="text-xs text-neutral-400">
                            {formatSourceDate(c.date)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
