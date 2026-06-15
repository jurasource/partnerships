"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runCrossCuttingAnalysis } from "@/lib/actions/research-actions";

type JobStatus = "pending" | "running" | "done" | "failed";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 120; // 120 × 2.5 s = 5 minutes maximum

/**
 * FirmAnalysisRefresh — re-runs cross-cutting analysis (ownership, risk flags,
 * conflicts, partnerships) without repeating the full AI research pass.
 *
 * Cross-cutting reads existing findings + CH PSC data only, so it's much
 * cheaper than a full research refresh. Useful after fixing extraction logic
 * or when research findings already exist but cross-cutting data needs updating.
 */
export function FirmAnalysisRefresh({
  firmId,
  firmName,
}: {
  firmId: string;
  firmName: string;
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

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

    const result = await runCrossCuttingAnalysis(firmId);

    if (!result.ok || !result.jobId) {
      setRunning(false);
      return;
    }

    const { jobId } = result;
    let pollCount = 0;

    intervalRef.current = setInterval(async () => {
      pollCount += 1;
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

        const job = (await res.json()) as { status: JobStatus };

        if (job.status === "done" || job.status === "failed") {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setRunning(false);
          if (job.status === "done") router.refresh();
        } else if (pollCount >= MAX_POLLS) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setRunning(false);
        }
      } catch {
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
      variant="outline"
      onClick={handleRefresh}
      disabled={running}
      title={running ? `Re-running analysis for ${firmName}…` : `Re-run cross-cutting analysis for ${firmName}`}
      className={cn(
        "gap-2",
        running && "opacity-75 cursor-not-allowed",
      )}
    >
      <BrainCircuit
        className={cn("h-4 w-4", running && "animate-pulse")}
        aria-hidden="true"
      />
      {running ? "Analysing…" : "Re-run Analysis"}
    </Button>
  );
}
