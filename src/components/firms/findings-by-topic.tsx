"use client";

import { ExternalLink } from "lucide-react";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn, isSafeUrl } from "@/lib/utils";
import type { FindingByTopic } from "@/lib/queries/firm-profile";

type FindingsByTopicProps = {
  findingsByTopic: FindingByTopic[];
};

/**
 * Source-type badge inline below each finding body.
 *
 * "Verified API" — bg-sky-50 text-sky-700 border-sky-100 (PROF-02)
 * "AI Research"  — bg-violet-50 text-violet-700 border-violet-100 (PROF-02)
 */
function SourceTypeBadge({
  sourceType,
}: {
  sourceType: "structured" | "ai";
}) {
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

/**
 * FindingsByTopic — per-topic tab set for the firm profile page.
 *
 * One TabsTrigger/TabsContent per topic. Content rendering:
 *   - finding === null → empty state: "No findings yet" heading + body
 *   - isNotFound === true → "Nothing found for this topic." + AI reason
 *   - else → full finding summary (text-sm, no truncation per UI-SPEC),
 *             source-type badge below, citation link if sourceUrl is real
 */
export function FindingsByTopic({ findingsByTopic }: FindingsByTopicProps) {
  if (findingsByTopic.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">
          No findings yet
        </h2>
        <p className="text-sm text-neutral-500">
          Research hasn&apos;t run for this topic. Use Refresh Research to generate findings.
        </p>
      </div>
    );
  }

  const defaultTab = findingsByTopic[0]?.topic.id;

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList
        variant="line"
        className="flex w-full flex-wrap gap-1 mb-4"
      >
        {findingsByTopic.map((entry) => (
          <TabsTrigger key={entry.topic.id} value={entry.topic.id}>
            {entry.topic.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {findingsByTopic.map((entry) => (
        <TabsContent key={entry.topic.id} value={entry.topic.id}>
          {entry.finding === null ? (
            /* Empty state — topic has no finding at all */
            <div className="py-6">
              <h2 className="text-xl font-semibold text-neutral-700 mb-2">
                No findings yet
              </h2>
              <p className="text-sm text-neutral-500">
                Research hasn&apos;t run for this topic. Use Refresh Research to generate findings.
              </p>
            </div>
          ) : entry.isNotFound ? (
            /* Not-found sentinel — research ran but found nothing */
            <div className="py-6">
              <p className="text-sm font-medium text-neutral-700 mb-2">
                Nothing found for this topic.
              </p>
              <p className="text-sm text-neutral-500">
                {entry.finding.summary.startsWith("Not found:")
                  ? entry.finding.summary.slice("Not found:".length).trim()
                  : entry.finding.summary}
              </p>
            </div>
          ) : (
            /* Real finding */
            <div className="py-6 space-y-3">
              {/* Full finding body — no truncation per UI-SPEC (intelligence tool) */}
              <p className="text-sm text-neutral-700 leading-relaxed">
                {entry.finding.summary}
              </p>

              {/* Source-type badge */}
              {entry.sourceType !== null && (
                <div className="flex items-center gap-2">
                  <SourceTypeBadge sourceType={entry.sourceType} />

                  {/* Citation link — only for safe URLs (T-03-03: not-found excluded above) */}
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
        </TabsContent>
      ))}
    </Tabs>
  );
}
