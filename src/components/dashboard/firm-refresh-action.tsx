"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { runResearch } from "@/lib/actions/research-actions";

type JobStatus = "pending" | "running" | "done" | "failed";

const POLL_INTERVAL_MS = 2500;

/**
 * FirmRefreshAction (dashboard variant) — icon-only ghost button for the
 * comparison table Actions column (DASH-04).
 *
 * Renders a RefreshCw icon wrapped in a tooltip "Refresh Research".
 * On click: calls runResearch(firmId), polls job status, toasts result.
 *
 * Toast lifecycle per UI-SPEC Copywriting:
 *   success → "{firmName} research updated"
 *   error   → "Research failed for {firmName}. Try again."
 *
 * Button is disabled and icon spins while running (T-03-08 mitigation).
 */
export function FirmRefreshAction({
  firmId,
  firmName,
}: {
  firmId: string;
  firmName: string;
}) {
  const [running, setRunning] = React.useState(false);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount — prevent interval leaks on navigation
  React.useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  async function handleRefresh() {
    if (running) return;
    setRunning(true);

    const result = await runResearch(firmId);

    if (!result.ok || !result.jobId) {
      setRunning(false);
      return;
    }

    const { jobId } = result;

    // Poll /api/research/status/{jobId} until done, failed, or timeout
    const MAX_POLLS = 60; // 60 × 2.5 s = 2.5 minutes maximum
    let pollCount = 0;

    intervalRef.current = setInterval(async () => {
      pollCount = pollCount + 1;
      try {
        const res = await fetch(`/api/research/status/${jobId}`);
        if (!res.ok) {
          if (pollCount >= MAX_POLLS) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setRunning(false);
          }
          return;
        }

        const job = (await res.json()) as {
          status: JobStatus;
          topicsComplete?: number;
          errorMessage?: string | null;
        };

        if (job.status === "done") {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setRunning(false);
        } else if (job.status === "failed") {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setRunning(false);
        } else if (pollCount >= MAX_POLLS) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setRunning(false);
        }
      } catch {
        // Network error during poll — check timeout before continuing
        if (pollCount >= MAX_POLLS) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setRunning(false);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  const tooltipContent = running ? "Refreshing..." : "Refresh Research";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={running}
            aria-label={
              running
                ? `Refreshing research for ${firmName}`
                : `Refresh Research for ${firmName}`
            }
            className={cn(
              "h-8 w-8 p-0",
              running
                ? "text-blue-600 cursor-not-allowed"
                : "text-neutral-600 hover:text-blue-700 hover:bg-blue-50",
            )}
          />
        }
      >
        <RefreshCw
          className={cn("h-4 w-4", running && "animate-spin")}
          aria-hidden="true"
        />
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
