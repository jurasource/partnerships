"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { runResearch } from "@/lib/actions/research-actions";
import { JobStatusBadge } from "@/components/research/job-status-badge";

type JobStatus = "pending" | "running" | "done" | "failed";

const TOPICS_TOTAL = 7;
const POLL_INTERVAL_MS = 2500;

/**
 * FirmRowResearch — per-firm AI research trigger with live polling.
 *
 * Calls runResearch(firmId), receives a jobId, then polls
 * GET /api/research/status/{jobId} every 2.5s. Shows a JobStatusBadge and
 * N/7 progress counter while running. Toasts the full lifecycle.
 *
 * Button is disabled (with explanatory tooltip) when companiesHouseNumber is null.
 */
export function FirmRowResearch({
  firmId,
  firmName,
  companiesHouseNumber,
}: {
  firmId: string;
  firmName: string;
  companiesHouseNumber: string | null;
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState<JobStatus | null>(null);
  const [topicsComplete, setTopicsComplete] = React.useState(0);

  // Ref holds the active polling interval so React's useEffect can clear it on
  // unmount. The interval must NOT be stored only as a local variable inside the
  // click handler — async handlers return a cleanup to no one; React never calls it.
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount — guarantees no interval leaks when the user navigates away
  // while research is still running (CR-02).
  React.useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const isDisabled = companiesHouseNumber === null;

  async function handleResearch() {
    if (running || isDisabled) return;
    setRunning(true);
    setJobStatus("pending");
    setTopicsComplete(0);

    const toastId = toast.loading(`Starting research for ${firmName}…`, {
      description:
        "This takes around 20 seconds. Progress updates as topics complete.",
    });

    const result = await runResearch(firmId);

    if (!result.ok || !result.jobId) {
      toast.error(`Research failed for ${firmName}`, {
        id: toastId,
        description:
          result.error ??
          "The research worker stopped unexpectedly. Try again, or check the app logs.",
      });
      setRunning(false);
      setJobStatus("failed");
      return;
    }

    const { jobId } = result;

    // Begin polling job status every 2.5s until done or failed.
    // Store in intervalRef so the useEffect cleanup above can clear it on unmount.
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/research/status/${jobId}`);
        if (!res.ok) return;

        const job = await res.json() as {
          status: JobStatus;
          topicsComplete?: number;
          topicsTotal?: number;
          errorMessage?: string | null;
        };

        setJobStatus(job.status);
        if (typeof job.topicsComplete === "number") {
          setTopicsComplete(job.topicsComplete);
        }

        if (job.status === "done") {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          const count = typeof job.topicsComplete === "number" ? job.topicsComplete : topicsComplete;
          toast.success("Research complete", {
            id: toastId,
            description: `${count} findings written for ${firmName}.`,
          });
          router.refresh();
          setRunning(false);
        } else if (job.status === "failed") {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          toast.error(`Research failed for ${firmName}`, {
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

  const progressValue = topicsComplete > 0
    ? Math.round((topicsComplete / TOPICS_TOTAL) * 100)
    : 0;

  const showProgress = running && jobStatus === "running";

  const tooltipContent = isDisabled
    ? "Add a Companies House number before running research"
    : running
    ? `Researching… (${topicsComplete}/${TOPICS_TOTAL} topics)`
    : `Run AI research for ${firmName}`;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResearch}
              disabled={running || isDisabled}
              aria-label={
                running
                  ? `Research running for ${firmName}`
                  : `Run AI research for ${firmName}`
              }
              className={cn(
                "h-8 px-2",
                isDisabled
                  ? "text-neutral-300 cursor-not-allowed"
                  : "text-neutral-600 hover:text-blue-700 hover:bg-blue-50",
              )}
            />
          }
        >
          <FlaskConical
            className={cn("h-4 w-4", running && "animate-spin")}
            aria-hidden="true"
          />
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>

      {jobStatus !== null && (
        <JobStatusBadge status={jobStatus} />
      )}

      {showProgress && (
        <div className="flex flex-col gap-1 min-w-[120px]">
          <Progress value={progressValue} className="h-1.5 w-full" />
          <span className="text-xs text-neutral-500">
            {topicsComplete} / {TOPICS_TOTAL} topics complete
          </span>
        </div>
      )}

      {running && jobStatus === "pending" && (
        <span className="text-xs text-neutral-500 animate-pulse">
          Starting…
        </span>
      )}
    </div>
  );
}
