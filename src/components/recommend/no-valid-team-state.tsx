"use client";

import { Users } from "lucide-react";

type NoValidTeamStateProps = {
  reason?: string;
};

const DEFAULT_BODY =
  "No firm combination satisfies the requested capability mix without conflicts. Adjust the mix or unlock firms and try again.";

export function NoValidTeamState({ reason }: NoValidTeamStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 rounded-full bg-neutral-100 p-4">
        <Users className="h-8 w-8 text-neutral-400" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-700 mb-2">
        No valid consortium found
      </h2>
      <p className="text-sm text-neutral-500 max-w-sm">{reason || DEFAULT_BODY}</p>
    </div>
  );
}
