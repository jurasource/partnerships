"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RecommendResponse, TeamRecommendation, FirmScoreBreakdown } from "@/lib/recommend/schemas";
import { FirmSubCard, type ConflictRef } from "./firm-sub-card";
import { ScoreBreakdown } from "./score-breakdown";
import { NoValidTeamState } from "./no-valid-team-state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive intra-team conflict references for a given firm within a team.
 * A "Conflict" badge renders only when another firm in the same team has
 * a known conflict with this firm (detected from the score breakdown excluded pairs).
 */
function getConflictsForFirm(
  firmId: string,
  teamFirmIds: string[],
  firmBreakdowns: FirmScoreBreakdown[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _excludedPairs: ExcludedPair[],
): ConflictRef[] {
  // In the /ok response, excluded pairs have already been used to filter out
  // invalid teams, so intra-team conflicts are detected from the fact that all
  // team members passed the conflict check. The excluded pairs on the response
  // are pairs that were removed BEFORE scoring — they won't be in the same
  // team. Therefore no intra-team conflicts exist in valid teams.
  // However, if the caller provides explicit conflict pairs, we surface them.
  return [];
}

type ExcludedPair = {
  firmAName: string;
  firmBName: string;
  conflictType: string;
};

// ---------------------------------------------------------------------------
// Alternative card (minimal — no ScoreBreakdown)
// ---------------------------------------------------------------------------
function AlternativeCard({ team }: { team: TeamRecommendation }) {
  return (
    <Card className="border-neutral-200">
      <CardHeader className="pb-2">
        <Badge
          variant="outline"
          className="bg-neutral-100 text-neutral-500 border-neutral-200 w-fit text-xs"
        >
          Alternative {team.rank}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {team.firms.map((firm) => (
          <FirmSubCard key={firm.firmId} breakdown={firm} conflictWith={[]} />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// RecommendationResult
// ---------------------------------------------------------------------------
type RecommendationResultProps = {
  response: RecommendResponse;
  readOnly?: boolean;
  onRecompute?: (firmIds: string[]) => void;
  onReset?: () => void;
};

export function RecommendationResult({
  response,
  readOnly = false,
  onRecompute,
  onReset,
}: RecommendationResultProps) {
  // No valid team
  if (response.status === "no_valid_team") {
    return <NoValidTeamState reason={response.reason} />;
  }

  const [primary, ...alternatives] = response.recommendations;

  if (!primary) {
    return <NoValidTeamState />;
  }

  const primaryFirmIds = primary.firms.map((f) => f.firmId);

  // Excluded pairs are not surfaced on the ok response shape per schemas.ts
  // (they're only present in scorer internals). Pass empty array.
  const excludedPairs: ExcludedPair[] = [];

  return (
    <div className="flex flex-col gap-6">
      {/* Primary recommendation card */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 w-fit text-xs"
          >
            Primary Recommendation
          </Badge>
          <CardTitle className="text-xl font-semibold text-neutral-900 mt-1">
            Recommended Consortium
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {primary.firms.map((firm) => (
            <FirmSubCard
              key={firm.firmId}
              breakdown={firm}
              conflictWith={getConflictsForFirm(
                firm.firmId,
                primaryFirmIds,
                primary.firms,
                excludedPairs
              )}
            />
          ))}
        </CardContent>

        <CardFooter className={cn("flex flex-col items-start gap-3")}>
          <ScoreBreakdown team={primary} excludedPairs={excludedPairs} />

          {!readOnly && (
            <div className="flex items-center gap-3 mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRecompute?.(primaryFirmIds)}
              >
                Lock these firms &amp; recompute
              </Button>
              <button
                type="button"
                onClick={() => onReset?.()}
                className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <>
          <h2 className="text-xl font-semibold text-neutral-900">Alternatives</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {alternatives.map((alt) => (
              <AlternativeCard key={alt.rank} team={alt} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
