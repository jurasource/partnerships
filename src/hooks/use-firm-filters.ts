"use client";

import * as React from "react";
import type { FirmWithGroups } from "@/lib/types";

export type ResearchStatus = "all" | "researched" | "not_researched" | "stale";

export const RESEARCH_STATUS_LABELS: Record<ResearchStatus, string> = {
  all: "All",
  researched: "Researched",
  not_researched: "Not researched",
  stale: "Stale (>30 days)",
};

export type FirmFilterState = {
  allGroups: Array<{ id: string; name: string }>;
  selectedGroupIds: string[];
  selectedCapabilities: string[];
  researchStatus: ResearchStatus;
  filteredData: FirmWithGroups[];
  onGroupsChange: (ids: string[]) => void;
  onCapabilitiesChange: (caps: string[]) => void;
  onResearchStatusChange: (status: ResearchStatus) => void;
};

export function useFirmFilters(data: FirmWithGroups[]): FirmFilterState {
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = React.useState<string[]>([]);
  const [researchStatus, setResearchStatus] = React.useState<ResearchStatus>("all");

  const allGroups = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const firm of data) {
      for (const g of firm.groups) {
        if (!seen.has(g.id)) seen.set(g.id, g.name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const filteredData = React.useMemo(() => {
    return data.filter((firm) => {
      if (selectedGroupIds.length > 0) {
        const firmGroupIds = firm.groups.map((g) => g.id);
        if (!selectedGroupIds.some((id) => firmGroupIds.includes(id))) return false;
      }

      if (selectedCapabilities.length > 0) {
        let tags: string[] = [];
        try {
          tags = JSON.parse(firm.capabilityTags as string) as string[];
        } catch {
          tags = [];
        }
        if (!selectedCapabilities.some((cap) => tags.includes(cap))) return false;
      }

      if (researchStatus !== "all") {
        const lastResearched = firm.lastResearchedAt;
        if (researchStatus === "researched" && lastResearched == null) return false;
        if (researchStatus === "not_researched" && lastResearched != null) return false;
        if (researchStatus === "stale") {
          if (lastResearched == null) return false;
          const isStale =
            Date.now() - new Date(lastResearched).getTime() > 30 * 24 * 60 * 60 * 1000;
          if (!isStale) return false;
        }
      }

      return true;
    });
  }, [data, selectedGroupIds, selectedCapabilities, researchStatus]);

  return {
    allGroups,
    selectedGroupIds,
    selectedCapabilities,
    researchStatus,
    filteredData,
    onGroupsChange: setSelectedGroupIds,
    onCapabilitiesChange: setSelectedCapabilities,
    onResearchStatusChange: setResearchStatus,
  };
}
