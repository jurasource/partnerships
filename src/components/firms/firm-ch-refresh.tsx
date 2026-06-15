"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/research/job-status-badge";
import { cn } from "@/lib/utils";
import { runCHRefreshJob } from "@/lib/actions/research-actions";

type JobStatus = "pending" | "running" | "done" | "failed";

const POLL_INTERVAL_MS = 2500;

export function FirmCHRefresh({ firmId }: { firmId: string }) {
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

  async function handleRefresh() {
    if (running) return;
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

        const job = await res.json() as { status: JobStatus; errorMessage?: string | null };
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

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={running}
        title="Fetch latest Companies House data and re-derive ownership fields"
        className={cn("gap-1.5", running && "opacity-75 cursor-not-allowed")}
      >
        <Building2 className={cn("h-3.5 w-3.5", running && "animate-pulse")} aria-hidden="true" />
        {running ? "Refreshing…" : "Refresh CH Data"}
      </Button>
      {jobStatus !== null && <JobStatusBadge status={jobStatus} />}
    </div>
  );
}
