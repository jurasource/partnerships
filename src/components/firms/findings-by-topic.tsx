"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { isSafeUrl } from "@/lib/utils";
import type { FindingByTopic } from "@/lib/queries/firm-profile";

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
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">
            {entry.topic.name}
          </h3>

          {entry.finding === null ? (
            <p className="text-sm text-neutral-400 italic">
              No findings yet — run Refresh Research to populate.
            </p>
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
              {entry.sourceType !== null && (
                <div className="flex items-center gap-2">
                  <SourceTypeBadge sourceType={entry.sourceType} />
                  {isSafeUrl(entry.finding.sourceUrl) && (
                    <a
                      href={entry.finding.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-xs inline-flex items-center gap-1"
                    >
                      {entry.finding.sourceTitle || "Source"}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
