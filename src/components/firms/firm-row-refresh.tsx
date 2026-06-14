"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { refreshFirm } from "@/lib/actions/refresh-actions";

/**
 * Per-firm refresh control (UI-SPEC). Icon button that re-fetches CH/CF/FTS data
 * for the firm via the refreshFirm server action, shows an inline spinner while
 * running, and toasts success or the UI-SPEC data-API error copy on failure.
 */
export function FirmRowRefresh({
  firmId,
  firmName,
}: {
  firmId: string;
  firmName: string;
}) {
  const [running, setRunning] = React.useState(false);

  async function handleRefresh() {
    if (running) return;
    setRunning(true);
    const toastId = toast.loading(`Refreshing ${firmName}…`, {
      description: "Fetching CH profile and procurement records — typically 10–30s.",
    });
    try {
      const result = await refreshFirm(firmId);
      if (result.ok) {
        toast.success("Procurement data refreshed", {
          id: toastId,
          description: `Latest contracts and ownership pulled for ${firmName}.`,
        });
      } else {
        toast.error("Couldn't load procurement data", {
          id: toastId,
          description:
            result.error ??
            "The data source didn't respond. Try again in a moment.",
        });
      }
    } catch {
      toast.error("Couldn't load procurement data", {
        id: toastId,
        description: "The data source didn't respond. Try again in a moment.",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={running}
              aria-label={`Refresh ${firmName}`}
              className="h-8 px-2 text-neutral-600 hover:text-blue-700 hover:bg-blue-50"
            />
          }
        >
          <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
        </TooltipTrigger>
        <TooltipContent>
          {running ? "Fetching data… (10–30s)" : "Refresh CH / Contracts Finder / Find a Tender"}
        </TooltipContent>
      </Tooltip>
      {running && (
        <span className="text-xs text-neutral-500 animate-pulse">Fetching…</span>
      )}
    </div>
  );
}
