"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { type ResearchStatus, RESEARCH_STATUS_LABELS } from "@/hooks/use-firm-filters";

type FirmsFilterBarProps = {
  allGroups: Array<{ id: string; name: string }>;
  allCapabilities: string[];
  selectedGroupIds: string[];
  selectedCapabilities: string[];
  researchStatus: ResearchStatus;
  onGroupsChange: (ids: string[]) => void;
  onCapabilitiesChange: (caps: string[]) => void;
  onResearchStatusChange: (status: ResearchStatus) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

// ---------------------------------------------------------------------------
// FirmsFilterBar
// ---------------------------------------------------------------------------
export function FirmsFilterBar({
  allGroups,
  allCapabilities,
  selectedGroupIds,
  selectedCapabilities,
  researchStatus,
  onGroupsChange,
  onCapabilitiesChange,
  onResearchStatusChange,
}: FirmsFilterBarProps) {
  const hasActiveFilters =
    selectedGroupIds.length > 0 ||
    selectedCapabilities.length > 0 ||
    researchStatus !== "all";

  function clearFilters() {
    onGroupsChange([]);
    onCapabilitiesChange([]);
    onResearchStatusChange("all");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Groups multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-sm font-normal"
            />
          }
        >
          Groups
          {selectedGroupIds.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-xs font-medium">
              {selectedGroupIds.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {allGroups.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-neutral-400 italic">
              No groups defined
            </div>
          ) : (
            allGroups.map((group) => (
              <DropdownMenuCheckboxItem
                key={group.id}
                checked={selectedGroupIds.includes(group.id)}
                onCheckedChange={() =>
                  onGroupsChange(toggleItem(selectedGroupIds, group.id))
                }
              >
                {group.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Capabilities multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-sm font-normal"
            />
          }
        >
          Capabilities
          {selectedCapabilities.length > 0 && (
            <span className="ml-1 rounded-full bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-xs font-medium">
              {selectedCapabilities.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {allCapabilities.map((cap) => (
            <DropdownMenuCheckboxItem
              key={cap}
              checked={selectedCapabilities.includes(cap)}
              onCheckedChange={() =>
                onCapabilitiesChange(toggleItem(selectedCapabilities, cap))
              }
            >
              {cap}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Research status single-select */}
      <Select
        value={researchStatus}
        onValueChange={(value: string | null) =>
          onResearchStatusChange((value ?? "all") as ResearchStatus)
        }
      >
        <SelectTrigger size="sm" className="h-8 w-auto min-w-[140px] text-sm font-normal">
          <SelectValue placeholder="Research status" />
        </SelectTrigger>
        <SelectContent align="start">
          {(Object.entries(RESEARCH_STATUS_LABELS) as [ResearchStatus, string][]).map(
            ([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>

      {/* Clear filters — only visible when a filter is active */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-sm text-neutral-500 hover:text-neutral-700"
          onClick={clearFilters}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
