"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

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
  const router = useRouter();
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
          router.refresh();
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
