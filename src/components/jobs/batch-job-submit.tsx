"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, FlaskConical, BrainCircuit, Building2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runBatchJobs, type BatchJobType } from "@/lib/actions/research-actions";

type FirmListItem = {
  id: string;
  canonicalName: string;
  companiesHouseNumber: string | null;
  lastResearchedAt: string | null;
};

type Props = {
  onJobsSubmitted: () => void;
};

export function BatchJobSubmit({ onJobsSubmitted }: Props) {
  const [open, setOpen] = React.useState(false);
  const [firms, setFirms] = React.useState<FirmListItem[]>([]);
  const [loadingFirms, setLoadingFirms] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [jobType, setJobType] = React.useState<BatchJobType>("research");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ enqueued: number; skipped: Array<{ firmName: string; reason: string }> } | null>(null);

  // Fetch firms when panel first opens
  React.useEffect(() => {
    if (!open || firms.length > 0) return;
    setLoadingFirms(true);
    fetch("/api/firms")
      .then((r) => r.json())
      .then((data: FirmListItem[]) => setFirms(data))
      .catch(() => {})
      .finally(() => setLoadingFirms(false));
  }, [open, firms.length]);

  // Reset result when panel closes
  React.useEffect(() => {
    if (!open) setResult(null);
  }, [open]);

  // Eligibility checks per job type
  function isEligible(firm: FirmListItem): boolean {
    if (jobType === "research" || jobType === "ch-refresh") return firm.companiesHouseNumber !== null;
    return firm.lastResearchedAt !== null;
  }

  const eligibleFirms = firms.filter(isEligible);

  function toggleFirm(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(eligibleFirms.map((f) => f.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  // When job type changes, drop any selected firms that are no longer eligible
  React.useEffect(() => {
    setSelectedIds((prev) => {
      const eligibleSet = new Set(eligibleFirms.map((f) => f.id));
      const next = new Set([...prev].filter((id) => eligibleSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobType]);

  async function handleSubmit() {
    if (selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await runBatchJobs([...selectedIds], jobType);
      setResult(res);
      setSelectedIds(new Set());
      if (res.enqueued > 0) onJobsSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
      >
        <span className="text-sm font-medium text-neutral-800">Submit batch jobs</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-neutral-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-4 pb-4 pt-3 space-y-4">
          {/* Job type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setJobType("research")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors",
                jobType === "research"
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Research + Analysis
            </button>
            <button
              type="button"
              onClick={() => setJobType("analysis")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors",
                jobType === "analysis"
                  ? "bg-violet-50 border-violet-300 text-violet-700 font-medium"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              Analysis only
            </button>
            <button
              type="button"
              onClick={() => setJobType("ch-refresh")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors",
                jobType === "ch-refresh"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-medium"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              CH Refresh
            </button>
          </div>

          <p className="text-xs text-neutral-500">
            {jobType === "research"
              ? "Runs full AI research (all 7 topics + Tavily searches) then automatically triggers cross-cutting analysis and CH refresh. Requires a Companies House number."
              : jobType === "ch-refresh"
              ? "Fetches a fresh Companies House snapshot and re-derives ownership fields (UK incorporated, country of ownership, etc.). Requires a Companies House number."
              : "Re-derives risk flags, conflicts, and partnerships from existing findings — no Tavily searches. Requires the firm to have been researched at least once."}
          </p>

          {/* Firm list */}
          {loadingFirms ? (
            <p className="text-sm text-neutral-400">Loading firms…</p>
          ) : firms.length === 0 ? (
            <p className="text-sm text-neutral-400">No firms found. Add firms first.</p>
          ) : (
            <div className="space-y-2">
              {/* Select all / none */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select all eligible ({eligibleFirms.length})
                </button>
                {selectedCount > 0 && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <button
                      type="button"
                      onClick={selectNone}
                      className="text-xs text-neutral-500 hover:underline"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              {/* Firm rows */}
              <div className="rounded-md border border-neutral-100 divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                {firms.map((firm) => {
                  const eligible = isEligible(firm);
                  const checked = selectedIds.has(firm.id);
                  return (
                    <button
                      key={firm.id}
                      type="button"
                      disabled={!eligible}
                      onClick={() => eligible && toggleFirm(firm.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        eligible
                          ? "hover:bg-neutral-50 cursor-pointer"
                          : "cursor-not-allowed opacity-40",
                      )}
                    >
                      {checked ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-neutral-300" />
                      )}
                      <span className="flex-1 text-sm text-neutral-800 truncate">
                        {firm.canonicalName}
                      </span>
                      <span className="text-xs text-neutral-400 shrink-0">
                        {!eligible && (
                          jobType === "research" || jobType === "ch-refresh"
                            ? "No CH number"
                            : "Not yet researched"
                        )}
                        {eligible && firm.lastResearchedAt && (
                          <span className="text-green-600">Researched</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit result */}
          {result && (
            <div className="rounded-md bg-neutral-50 border border-neutral-100 px-3 py-2 text-sm space-y-1">
              <p className="font-medium text-neutral-800">
                {result.enqueued} job{result.enqueued !== 1 ? "s" : ""} submitted
              </p>
              {result.skipped.length > 0 && (
                <ul className="text-xs text-neutral-500 space-y-0.5">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      {s.firmName} — {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Submit button */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting
                ? "Submitting…"
                : selectedCount === 0
                ? "Select firms to submit"
                : `Submit ${selectedCount} job${selectedCount !== 1 ? "s" : ""}`}
            </Button>
            {selectedCount > 0 && !submitting && (
              <span className="text-xs text-neutral-500">
                {selectedCount} firm{selectedCount !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
