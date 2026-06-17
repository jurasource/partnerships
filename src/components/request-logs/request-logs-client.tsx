"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, ChevronRight, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LogRow = {
  id: string;
  type: "tavily_search" | "llm_call";
  createdAt: string;
  jobId: string | null;
  firmId: string | null;
  firmName: string | null;
  topicId: string | null;
  topicName: string | null;
  searchQuery: string | null;
  model: string | null;
  inputTokens: string | null;
  outputTokens: string | null;
  cacheCreatedTokens: string | null;
  cacheReadTokens: string | null;
  finishReason: string | null;
  isRetry: string | null;
  durationMs: string | null;
  errorMessage: string | null;
};

type LogDetail = LogRow & {
  searchResultsJson: string | null;
  promptJson: string | null;
  rawResponse: string | null;
};

type ActiveTab = "all" | "tavily_search" | "llm_call";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function TypeBadge({ type }: { type: "tavily_search" | "llm_call" }) {
  if (type === "tavily_search") {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-mono text-xs">Tavily</Badge>;
  }
  return <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-mono text-xs">LLM</Badge>;
}

function CollapsibleBlock({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <span>{label}</span>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all bg-background max-h-80 overflow-y-auto">
          {content}
        </pre>
      )}
    </div>
  );
}

function DetailDrawer({ logId, onClose }: { logId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/request-logs/${logId}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [logId]);

  function prettyJson(raw: string | null) {
    if (!raw) return "(empty)";
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  }

  return (
    <SheetContent className="w-[620px] sm:max-w-[620px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="text-base">
          {detail ? (
            <span className="flex items-center gap-2">
              <TypeBadge type={detail.type} />
              {detail.firmName ?? detail.firmId ?? "—"} · {detail.topicName ?? "—"}
            </span>
          ) : "Log Detail"}
        </SheetTitle>
      </SheetHeader>

      {loading && <p className="text-sm text-muted-foreground mt-4">Loading…</p>}

      {detail && !loading && (
        <div className="mt-4 space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Time</dt>
            <dd>{formatTime(detail.createdAt)}</dd>
            <dt className="text-muted-foreground">Duration</dt>
            <dd>{detail.durationMs ? `${detail.durationMs}ms` : "—"}</dd>
            {detail.type === "llm_call" && (
              <>
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-mono">{detail.model ?? "—"}</dd>
                <dt className="text-muted-foreground">Tokens in / out</dt>
                <dd>{detail.inputTokens ?? "—"} / {detail.outputTokens ?? "—"}</dd>
                <dt className="text-muted-foreground">Cache created / read</dt>
                <dd>{detail.cacheCreatedTokens ?? "0"} / {detail.cacheReadTokens ?? "0"}</dd>
                <dt className="text-muted-foreground">Finish reason</dt>
                <dd className={detail.finishReason === "length" ? "text-amber-600 font-medium" : ""}>{detail.finishReason ?? "—"}</dd>
                <dt className="text-muted-foreground">Retry</dt>
                <dd>{detail.isRetry === "true" ? "Yes" : "No"}</dd>
              </>
            )}
            {detail.type === "tavily_search" && (
              <>
                <dt className="text-muted-foreground">Query</dt>
                <dd className="font-mono">{detail.searchQuery ?? "—"}</dd>
                <dt className="text-muted-foreground">Results</dt>
                <dd>{detail.searchResultsJson ? JSON.parse(detail.searchResultsJson).length : "—"}</dd>
              </>
            )}
            {detail.errorMessage && (
              <>
                <dt className="text-muted-foreground text-red-600">Error</dt>
                <dd className="text-red-600">{detail.errorMessage}</dd>
              </>
            )}
          </dl>

          <div className="space-y-2">
            {detail.type === "llm_call" && detail.promptJson && (
              <CollapsibleBlock
                label="System + User Prompt (JSON)"
                content={prettyJson(detail.promptJson)}
              />
            )}
            {detail.type === "llm_call" && detail.rawResponse && (
              <CollapsibleBlock
                label="Raw Model Response"
                content={detail.rawResponse}
              />
            )}
            {detail.type === "tavily_search" && detail.searchResultsJson && (
              <CollapsibleBlock
                label="Search Results (JSON)"
                content={prettyJson(detail.searchResultsJson)}
              />
            )}
          </div>
        </div>
      )}
    </SheetContent>
  );
}

export function RequestLogsClient() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (activeTab: ActiveTab) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (activeTab !== "all") params.set("type", activeTab);
      const res = await fetch(`/api/request-logs?${params}`);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  async function deleteOne(id: string) {
    if (!confirm("Delete this log entry?")) return;
    await fetch(`/api/request-logs/${id}`, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function deleteBulk(before?: string) {
    const label = before ? "log entries older than 30 days" : "ALL log entries";
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    const body = before ? JSON.stringify({ before }) : "{}";
    await fetch("/api/request-logs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body });
    void load(tab);
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "tavily_search", label: "Tavily Search" },
    { key: "llm_call", label: "LLM Call" },
  ];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Request Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Raw Tavily searches and LLM calls from the research worker
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => deleteBulk(thirtyDaysAgo)}>
            Clear &gt;30d
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteBulk()}>
            Clear all
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No log entries yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Entries appear here when the research worker runs.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-36">Time</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-44">Firm</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Topic / Query</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Tokens</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Cache hit</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-20">Duration</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={row.type} />
                    {row.isRetry === "true" && (
                      <span className="ml-1 text-xs text-amber-600">retry</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs truncate max-w-0 w-44">
                    {row.firmName ?? row.firmId ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-0">
                    {row.type === "llm_call"
                      ? (row.topicName ?? row.topicId ?? "—")
                      : (row.searchQuery ?? "—")}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                    {row.type === "llm_call" && row.inputTokens
                      ? `${row.inputTokens}→${row.outputTokens}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {row.type === "llm_call" && row.cacheReadTokens && row.cacheReadTokens !== "0" ? (
                      <span className="text-emerald-600 font-medium">⚡ {row.cacheReadTokens}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                    {row.durationMs ? `${row.durationMs}ms` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {row.errorMessage && (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                      <button
                        onClick={() => deleteOne(row.id)}
                        className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        {selectedId && (
          <DetailDrawer logId={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </Sheet>
    </div>
  );
}
