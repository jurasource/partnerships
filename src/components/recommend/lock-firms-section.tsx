"use client";

import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LockFirmsListItem } from "@/lib/queries/lock-firms";

const CAPABILITY_COLORS: Record<string, string> = {
  Nuclear: "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Consultancy: "bg-violet-100 text-violet-700 border-violet-200",
};

type LockFirmsSectionProps = {
  firms: LockFirmsListItem[];
  lockedIds: string[];
  onToggle: (firmId: string) => void;
};

export function LockFirmsSection({ firms, lockedIds, onToggle }: LockFirmsSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        Select firms that must appear in the recommendation.
      </p>
      {firms.length === 0 ? (
        <p className="text-sm text-neutral-400 italic">No firms added yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {firms.map((firm) => {
            const isLocked = lockedIds.includes(firm.id);
            return (
              <label
                key={firm.id}
                className="flex items-center gap-3 cursor-pointer select-none py-1"
              >
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={() => onToggle(firm.id)}
                  className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <span
                  className={cn(
                    "text-sm flex items-center gap-1.5",
                    isLocked ? "font-medium text-neutral-900" : "text-neutral-600"
                  )}
                >
                  {firm.canonicalName}
                  {isLocked && <Lock className="h-3 w-3 text-neutral-500" />}
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {firm.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={cn(
                        "text-xs px-1.5 py-0.5 border",
                        CAPABILITY_COLORS[tag] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"
                      )}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
