"use client";

import { LayersIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GroupForConsortium } from "@/lib/queries/groups-for-consortium";

type GroupScopeSelectorProps = {
  groups: GroupForConsortium[];
  value: string | null;
  onChange: (groupId: string | null) => void;
};

export function GroupScopeSelector({ groups, value, onChange }: GroupScopeSelectorProps) {
  if (groups.length === 0) return null;

  const selectedGroup = groups.find((g) => g.id === value);

  return (
    <div className="flex items-center gap-3">
      <LayersIcon className="h-4 w-4 text-neutral-400 shrink-0" />
      <div className="flex items-center gap-2 flex-1 max-w-xs">
        <Select
          value={value ?? "__all__"}
          onValueChange={(v) => onChange(v === "__all__" ? null : v)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="All firms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All firms</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedGroup && (
        <span className="text-xs text-neutral-500">
          {selectedGroup.firmIds.length} firm{selectedGroup.firmIds.length !== 1 ? "s" : ""} in scope
        </span>
      )}
    </div>
  );
}
