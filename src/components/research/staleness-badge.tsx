import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatAbsoluteDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Compute relative label: "today" (<1 day) or "{N} days ago".
 */
function formatRelativeDate(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "today";
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * StalenessBadge — per-firm research freshness indicator.
 *
 * - null lastResearchedAt → amber "Not researched" (never been researched)
 * - lastResearchedAt > 7 days ago → amber "Stale" + absolute date tooltip
 * - lastResearchedAt within 7 days → green "Researched {relative}" + absolute date tooltip
 */
export function StalenessBadge({
  lastResearchedAt,
}: {
  lastResearchedAt: string | null;
}) {
  const now = new Date();

  if (lastResearchedAt === null) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-xs font-normal px-1.5 py-0.5 border",
          "bg-slate-100 text-slate-500 border-slate-200",
        )}
      >
        Not researched
      </Badge>
    );
  }

  const researchedDate = new Date(lastResearchedAt);
  const diffMs = now.getTime() - researchedDate.getTime();
  const isStale = diffMs > SEVEN_DAYS_MS;
  const absoluteDate = formatAbsoluteDate(researchedDate);

  if (isStale) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-normal px-1.5 py-0.5 border cursor-default",
                "bg-orange-50 text-orange-600 border-orange-200",
              )}
            />
          }
        >
          Stale
        </TooltipTrigger>
        <TooltipContent>{absoluteDate}</TooltipContent>
      </Tooltip>
    );
  }

  const relative = formatRelativeDate(researchedDate, now);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-normal px-1.5 py-0.5 border cursor-default",
              "bg-emerald-50 text-emerald-600 border-emerald-100",
            )}
          />
        }
      >
        Researched {relative}
      </TooltipTrigger>
      <TooltipContent>{absoluteDate}</TooltipContent>
    </Tooltip>
  );
}
