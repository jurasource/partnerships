"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JobStatusBadge } from "@/components/research/job-status-badge";

type JobRow = {
  id: string;
  firmId: string;
  firmName: string | null;
  status: "pending" | "running" | "done" | "failed";
  progressMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
};

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const s = Math.floor((endMs - startMs) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function JobsPage() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok || cancelled) return;
        const data: JobRow[] = await res.json();
        setRows(data);
        const hasActive = data.some(
          (j) => j.status === "pending" || j.status === "running",
        );
        timeout = setTimeout(poll, hasActive ? 2000 : 10000);
      } catch {
        if (!cancelled) timeout = setTimeout(poll, 10000);
      } finally {
        setLoading(false);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const active = rows.filter(
    (j) => j.status === "pending" || j.status === "running",
  );
  const finished = rows.filter(
    (j) => j.status === "done" || j.status === "failed",
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Research Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live status of research jobs processed by the worker
          </p>
        </div>
        {active.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            {active.length} active
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Trigger research from a firm&apos;s profile page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <JobTable title="Active" jobs={active} />
          )}
          {finished.length > 0 && (
            <JobTable title="Completed" jobs={finished} />
          )}
        </div>
      )}
    </div>
  );
}

function JobTable({ title, jobs }: { title: string; jobs: JobRow[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </h2>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-48">Firm</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Started</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium truncate max-w-0 w-48">
                  <Link
                    href={`/firms/${job.firmId}`}
                    className="hover:underline text-foreground"
                  >
                    {job.firmName ?? job.firmId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {job.status === "running" && job.progressMessage ? (
                    job.progressMessage
                  ) : job.status === "failed" && job.errorMessage ? (
                    <span className="text-red-600 text-xs">{job.errorMessage}</span>
                  ) : job.status === "pending" ? (
                    <span className="text-muted-foreground/60">Waiting for worker…</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatTime(job.startedAt ?? job.createdAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatDuration(job.startedAt, job.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
