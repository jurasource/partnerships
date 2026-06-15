"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { runCHRefreshJob } from "@/lib/actions/research-actions";

type JobStatus = "pending" | "running" | "done" | "failed";

const POLL_INTERVAL_MS = 2500;

export function FirmRowCHRefresh({
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

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const isDisabled = companiesHouseNumber === null;

  async function handleRefresh() {
    if (running || isDisabled) return;
    setRunning(true);
    setJobStatus("pending");

    const result = await runCHRefreshJob(firmId);

    if (!result.ok || !result.jobId) {
      setRunning(false);
      setJobStatus("failed");
      return;
    }

    const { jobId } = result;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/research/status/${jobId}`);
        if (!res.ok) return;

        const job = await res.json() as { status: JobStatus };
        setJobStatus(job.status);

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
        }
      } catch {
        // Network error during poll — continue polling
      }
    }, POLL_INTERVAL_MS);
  }

  const tooltipText = isDisabled
    ? "Add a Companies House number to refresh CH data"
    : running
    ? `Refreshing CH data for ${firmName}…`
    : `Refresh CH data for ${firmName}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={running || isDisabled}
            aria-label={tooltipText}
            className={cn(
              "h-8 px-2",
              isDisabled
                ? "text-neutral-300 cursor-not-allowed"
                : jobStatus === "failed"
                ? "text-red-500 hover:text-red-600 hover:bg-red-50"
                : "text-neutral-600 hover:text-blue-700 hover:bg-blue-50",
            )}
          />
        }
      >
        <Building2
          className={cn("h-4 w-4", running && "animate-pulse")}
          aria-hidden="true"
        />
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
