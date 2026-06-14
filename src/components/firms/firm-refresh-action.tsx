"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runResearch } from "@/lib/actions/research-actions";

type JobStatus = "pending" | "running" | "done" | "failed";

const POLL_INTERVAL_MS = 2500;

/**
 * FirmRefreshAction — "Refresh Research" CTA for the firm profile page header.
 *
 * Calls runResearch(firmId), then polls /api/research/status/{jobId} until
 * done or failed. Mirrors the polling lifecycle from firm-row-research.tsx.
 *
 * Toast lifecycle per UI-SPEC Copywriting:
 *   success → "{firmName} research updated"
 *   error   → "Research failed for {firmName}. Try again."
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

    const toastId = toast.loading(`Starting research for ${firmName}…`, {
      description:
        "This takes around 20 seconds. Progress updates as topics complete.",
    });

    const result = await runResearch(firmId);

    if (!result.ok || !result.jobId) {
      toast.error(`Research failed for ${firmName}. Try again.`, {
        id: toastId,
        description:
          result.error ??
          "The research worker stopped unexpectedly. Try again, or check the app logs.",
      });
      setRunning(false);
      return;
    }

    const { jobId } = result;

    // Poll /api/research/status/{jobId} until done or failed
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/research/status/${jobId}`);
        if (!res.ok) return;

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
          toast.success(`${firmName} research updated`, {
            id: toastId,
          });
          setRunning(false);
        } else if (job.status === "failed") {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          toast.error(`Research failed for ${firmName}. Try again.`, {
            id: toastId,
            description:
              job.errorMessage ??
              "The research worker stopped unexpectedly. Try again, or check the app logs.",
          });
          setRunning(false);
        }
      } catch {
        // Network error during poll — continue polling, don't surface to user
      }
    }, POLL_INTERVAL_MS);
  }

  return (
    <Button
      type="button"
      onClick={handleRefresh}
      disabled={running}
      className={cn(
        "bg-blue-600 hover:bg-blue-700 text-white gap-2",
        running && "opacity-75 cursor-not-allowed",
      )}
    >
      <RefreshCw
        className={cn("h-4 w-4", running && "animate-spin")}
        aria-hidden="true"
      />
      {running ? "Refreshing..." : "Refresh Research"}
    </Button>
  );
}
