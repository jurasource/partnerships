import type { Firm, OwnershipRecord } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  allFirms: Firm[];
  ownershipRecords: OwnershipRecord[];
};

export function OwnershipRollup({ allFirms, ownershipRecords }: Props) {
  const total = allFirms.length;

  if (ownershipRecords.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No ownership data yet. Run research for at least one firm to enable ownership analysis.
      </p>
    );
  }

  const ownershipMap = new Map(
    ownershipRecords.map((r) => [r.firmId, r.countryOfOwnership]),
  );

  let ukCount = 0;
  let unknownCount = 0;
  const foreignCountryCounts = new Map<string, number>();

  for (const firm of allFirms) {
    const country = ownershipMap.get(firm.id);
    if (!ownershipMap.has(firm.id) || country === null || country === undefined) {
      unknownCount++;
    } else if (country.toUpperCase() === "UK") {
      ukCount++;
    } else {
      foreignCountryCounts.set(
        country.toUpperCase(),
        (foreignCountryCounts.get(country.toUpperCase()) ?? 0) + 1,
      );
    }
  }

  const foreignTotal = Array.from(foreignCountryCounts.values()).reduce(
    (sum, n) => sum + n,
    0,
  );

  const foreignBreakdown = Array.from(foreignCountryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([iso, count]) => `${iso}: ${count}`)
    .join(", ");

  const tiles = [
    {
      label: "Total Firms",
      count: total,
      bg: "bg-white",
    },
    {
      label: "UK-Owned",
      count: ukCount,
      bg: "bg-green-100",
    },
    {
      label: "Foreign-Owned",
      count: foreignTotal,
      bg: "bg-amber-100",
      tooltip: foreignBreakdown || undefined,
    },
    {
      label: "Ownership Unknown",
      count: unknownCount,
      bg: "bg-neutral-100",
    },
  ];

  return (
    <div className="flex flex-wrap gap-4">
      {tiles.map((tile) => {
        const inner = (
          <div
            key={tile.label}
            className={cn(
              "rounded-lg border p-4 flex flex-col gap-1 min-w-[120px]",
              tile.bg,
            )}
          >
            <span className="text-xl font-semibold text-neutral-900">
              {tile.count}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {tile.label}
            </span>
          </div>
        );

        if (tile.tooltip) {
          return (
            <Tooltip key={tile.label}>
              <TooltipTrigger render={<span className="cursor-default" />}>
                {inner}
              </TooltipTrigger>
              <TooltipContent>{tile.tooltip}</TooltipContent>
            </Tooltip>
          );
        }

        return inner;
      })}
    </div>
  );
}
