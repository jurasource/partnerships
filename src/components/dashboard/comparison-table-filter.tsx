"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CapabilityTag } from "@/lib/types";

// Active-state filled classes per tag — intensified version of TAG_STYLES
const ACTIVE_STYLES: Record<CapabilityTag, string> = {
  Nuclear: "bg-amber-200 text-amber-800 border-amber-300 hover:bg-amber-200",
  Infrastructure: "bg-sky-200 text-sky-800 border-sky-300 hover:bg-sky-200",
  Consultancy: "bg-violet-200 text-violet-800 border-violet-300 hover:bg-violet-200",
};

const TAGS: CapabilityTag[] = ["Nuclear", "Infrastructure", "Consultancy"];

type ComparisonTableFilterProps = {
  active: CapabilityTag[];
  onToggle: (tag: CapabilityTag) => void;
};

/**
 * ComparisonTableFilter — capability tag toggle filter bar (DASH-02).
 *
 * Three toggle Buttons for Nuclear / Infrastructure / Consultancy.
 * Active button = filled semantic tag color; inactive = outline.
 * OR logic: zero active = all firms shown.
 */
export function ComparisonTableFilter({
  active,
  onToggle,
}: ComparisonTableFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-neutral-600 font-medium">
        Filter by capability:
      </span>
      {TAGS.map((tag) => {
        const isActive = active.includes(tag);
        return (
          <Button
            key={tag}
            type="button"
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onToggle(tag)}
            className={cn(
              "h-7 px-3 text-xs font-medium border",
              isActive
                ? ACTIVE_STYLES[tag]
                : "text-neutral-600 hover:text-neutral-800",
            )}
            aria-pressed={isActive}
          >
            {tag}
          </Button>
        );
      })}
    </div>
  );
}
