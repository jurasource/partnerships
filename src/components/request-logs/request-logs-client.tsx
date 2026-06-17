"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, AlertCircle, Copy, Check, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type SearchResult = {
  url: string;
  title: string;
  snippet: string;
  publishedDate?: string | null;
};

type ContentPart = { type: string; text?: string };
type SystemBlock = { role: string; content: string | ContentPart[]; providerOptions?: unknown };
type PromptPayload = {
  system?: string | SystemBlock[];
  messages?: Array<{ role: string; content: string | ContentPart[] }>;
};
type FindingPayload = {
  summary?: string;
  confidence?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  rawSnippet?: string;
  sourceDate?: string | null;
  citations?: Array<{ url: string; title: string; snippet: string; date?: string | null }>;
};

function normalizeContent(content: string | ContentPart[] | unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as ContentPart[])
      .map((p) => (p.type === "text" ? (p.text ?? "") : `[${p.type}]`))
      .join("\n");
  }
  return String(content);
}

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

function CopyButton({ text, label = "Copy JSON" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-border bg-background hover:bg-muted/60 transition-colors shrink-0"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function SectionHeader({
  title,
  open,
  onToggle,
  copyText,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  copyText?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors flex-1 text-left"
      >
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        {title}
      </button>
      {copyText && <CopyButton text={copyText} />}
    </div>
  );
}

/* ---------- Search results ---------- */
function SearchResultsSection({ raw }: { raw: string | null }) {
  const [open, setOpen] = useState(true);
  if (!raw) return null;

  let results: SearchResult[] = [];
  try { results = JSON.parse(raw) as SearchResult[]; } catch { return null; }

  const pretty = JSON.stringify(results, null, 2);

  return (
    <div className="border rounded-lg overflow-hidden">
      <SectionHeader
        title={`Search Results (${results.length})`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        copyText={pretty}
      />
      {open && (
        <div className="divide-y">
          {results.map((r, i) => (
            <div key={i} className="px-4 py-3 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-snug">{r.title || "(no title)"}</p>
                {r.publishedDate && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {r.publishedDate.slice(0, 10)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{r.snippet}</p>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-mono break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {r.url}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Role pill ---------- */
function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    system: "text-amber-700 bg-amber-100",
    user: "text-blue-700 bg-blue-100",
    assistant: "text-purple-700 bg-purple-100",
  };
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${styles[role] ?? "text-muted-foreground bg-muted"}`}>
      {role}
    </span>
  );
}

/* ---------- LLM prompt ---------- */
function PromptSection({ raw }: { raw: string | null }) {
  const [open, setOpen] = useState(false);
  if (!raw) return null;

  let payload: PromptPayload = {};
  try { payload = JSON.parse(raw) as PromptPayload; } catch { return null; }

  const pretty = JSON.stringify(payload, null, 2);

  const systemBlocks: Array<{ role: string; content: string }> = payload.system
    ? Array.isArray(payload.system)
      ? payload.system.map((b) => ({ role: b.role, content: normalizeContent(b.content) }))
      : [{ role: "system", content: payload.system }]
    : [];

  const msgs = (payload.messages ?? []).map((m) => ({
    role: m.role,
    content: normalizeContent(m.content),
  }));

  const totalBlocks = systemBlocks.length + msgs.length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <SectionHeader
        title={`Prompt (${totalBlocks} block${totalBlocks !== 1 ? "s" : ""})`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        copyText={pretty}
      />
      {open && (
        <div className="divide-y">
          {systemBlocks.map((block, i) => (
            <div key={`sys-${i}`} className="px-4 py-3 space-y-1.5 bg-amber-50/40">
              <RolePill role={block.role} />
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{block.content}</p>
            </div>
          ))}
          {msgs.map((msg, i) => (
            <div key={`msg-${i}`} className={`px-4 py-3 space-y-1.5 ${msg.role === "user" ? "bg-background" : "bg-muted/20"}`}>
              <RolePill role={msg.role} />
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Model response ---------- */
function ResponseSection({ content }: { content: string | null }) {
  const [open, setOpen] = useState(true);
  if (!content) return null;

  let finding: FindingPayload | null = null;
  try {
    const parsed = JSON.parse(content) as FindingPayload;
    if (parsed && typeof parsed === "object" && "summary" in parsed) finding = parsed;
  } catch { /* render as plain text */ }

  const confidenceStyle = finding?.confidence === "HIGH"
    ? "text-emerald-700 bg-emerald-100"
    : finding?.confidence === "MEDIUM"
    ? "text-amber-700 bg-amber-100"
    : "text-muted-foreground bg-muted";

  return (
    <div className="border rounded-lg overflow-hidden">
      <SectionHeader
        title="Model Response"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        copyText={content}
      />
      {open && (
        finding ? (
          <div className="divide-y">
            {/* Summary */}
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</span>
                {finding.confidence && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${confidenceStyle}`}>
                    {finding.confidence}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{finding.summary}</p>
            </div>
            {/* Primary source */}
            {(finding.sourceUrl || finding.sourceTitle || finding.rawSnippet) && (
              <div className="px-4 py-3 space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Primary Source</span>
                {finding.sourceTitle && <p className="text-sm font-medium">{finding.sourceTitle}</p>}
                {finding.rawSnippet && <p className="text-xs text-muted-foreground leading-relaxed">{finding.rawSnippet}</p>}
                {finding.sourceUrl && finding.sourceUrl !== "not-found" && (
                  <a
                    href={finding.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-mono break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {finding.sourceUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}
                {finding.sourceDate && (
                  <p className="text-xs text-muted-foreground">{finding.sourceDate}</p>
                )}
              </div>
            )}
            {/* Additional citations */}
            {finding.citations && finding.citations.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Citations ({finding.citations.length})
                </span>
                {finding.citations.map((c, i) => (
                  <div key={i} className="space-y-0.5 pl-2 border-l-2 border-muted">
                    <p className="text-xs font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.snippet}</p>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-mono break-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
          </div>
        )
      )}
    </div>
  );
}

/* ---------- Meta row ---------- */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs">{children}</span>
    </div>
  );
}

/* ---------- Modal ---------- */
function DetailModal({ logId, onClose }: { logId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    fetch(`/api/request-logs/${logId}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d as LogDetail); setLoading(false); })
      .catch(() => setLoading(false));
  }, [logId]);

  const allRaw = detail ? JSON.stringify(detail, null, 2) : "";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!max-w-[90vw] w-[90vw] max-h-[92vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base">
            {detail ? (
              <span className="flex items-center gap-2.5 flex-wrap">
                <TypeBadge type={detail.type} />
                <span className="font-semibold">{detail.firmName ?? detail.firmId ?? "—"}</span>
                {(detail.topicName ?? detail.searchQuery) && (
                  <span className="text-muted-foreground font-normal">·</span>
                )}
                <span className="text-muted-foreground font-normal text-sm truncate">
                  {detail.topicName ?? detail.searchQuery ?? ""}
                </span>
              </span>
            ) : "Log Detail"}
          </DialogTitle>
          {detail && (
            <p className="text-xs text-muted-foreground mt-1">{formatTime(detail.createdAt)}</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {detail && !loading && (
            <>
              {/* Error banner */}
              {detail.errorMessage && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{detail.errorMessage}</span>
                </div>
              )}

              {/* Metadata grid */}
              <div className="rounded-lg border px-4 divide-y">
                <MetaRow label="Duration">
                  {detail.durationMs ? `${detail.durationMs} ms` : "—"}
                </MetaRow>

                {detail.type === "llm_call" && (
                  <>
                    <MetaRow label="Model">
                      <span className="font-mono">{detail.model ?? "—"}</span>
                    </MetaRow>
                    <MetaRow label="Tokens in / out">
                      {detail.inputTokens ?? "—"} / {detail.outputTokens ?? "—"}
                    </MetaRow>
                    <MetaRow label="Cache created / read">
                      <span>
                        {detail.cacheCreatedTokens ?? "0"} / {detail.cacheReadTokens ?? "0"}
                        {detail.cacheReadTokens && detail.cacheReadTokens !== "0" && (
                          <span className="ml-2 text-emerald-600 font-medium">⚡ cache hit</span>
                        )}
                      </span>
                    </MetaRow>
                    <MetaRow label="Finish reason">
                      <span className={detail.finishReason === "length" ? "text-amber-600 font-medium" : ""}>
                        {detail.finishReason ?? "—"}
                      </span>
                    </MetaRow>
                    <MetaRow label="Retry">
                      {detail.isRetry === "true"
                        ? <span className="text-amber-600 font-medium">Yes</span>
                        : "No"}
                    </MetaRow>
                  </>
                )}

                {detail.type === "tavily_search" && (
                  <>
                    <MetaRow label="Query">
                      <span className="font-mono">{detail.searchQuery ?? "—"}</span>
                    </MetaRow>
                    <MetaRow label="Results returned">
                      {detail.searchResultsJson
                        ? (() => {
                            try { return String((JSON.parse(detail.searchResultsJson) as unknown[]).length); }
                            catch { return "—"; }
                          })()
                        : "—"}
                    </MetaRow>
                  </>
                )}

                <MetaRow label="Job ID">
                  <span className="font-mono text-muted-foreground">{detail.jobId ?? "—"}</span>
                </MetaRow>
              </div>

              {/* Rich content sections */}
              {detail.type === "tavily_search" && (
                <SearchResultsSection raw={detail.searchResultsJson} />
              )}
              {detail.type === "llm_call" && (
                <>
                  <ResponseSection content={detail.rawResponse} />
                  <PromptSection raw={detail.promptJson} />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {detail && !loading && (
          <div className="px-6 py-3 border-t bg-muted/20 shrink-0 flex justify-end">
            <CopyButton text={allRaw} label="Copy raw JSON" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Main list ---------- */
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
      if (res.ok) setRows(await res.json() as LogRow[]);
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

      {selectedId && (
        <DetailModal logId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
