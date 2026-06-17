"use client";

import { useState } from "react";
import { Copy, Download, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ConsortiumSuggestion } from "@/lib/consortium/types";

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const colour =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-2 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-neutral-700 w-8 text-right">{pct}%</span>
    </div>
  );
}

type ConsortiumCardProps = {
  suggestion: ConsortiumSuggestion;
  rank: number;
};

function ConsortiumCard({ suggestion, rank }: ConsortiumCardProps) {
  const [expanded, setExpanded] = useState(rank === 1);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
            {rank}
          </span>
          <span className="font-semibold text-neutral-900 truncate">{suggestion.name}</span>
          <div className="flex gap-1.5 flex-wrap">
            {suggestion.firms.map((f) => (
              <span
                key={f.name}
                className="inline-flex items-center gap-1 text-xs bg-neutral-100 text-neutral-700 rounded-full px-2.5 py-0.5"
              >
                <span className="font-medium">{f.name}</span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-500 max-w-[140px] truncate">{f.role}</span>
              </span>
            ))}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-neutral-400 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0 ml-2" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-neutral-100">
          {/* Firm roles */}
          <div className="pt-4">
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Member firms
            </h4>
            <ul className="space-y-1.5">
              {suggestion.firms.map((f) => (
                <li key={f.name} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="font-medium text-neutral-800">{f.name}</span>
                  <span className="text-neutral-400">—</span>
                  <span className="text-neutral-600">{f.role}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rationale */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
              Strategic rationale
            </h4>
            <p className="text-sm text-neutral-700 leading-relaxed">{suggestion.rationale}</p>
          </div>

          {/* Risks */}
          {suggestion.risks && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-amber-800 mb-1">Risks & red flags</h4>
                  <p className="text-sm text-amber-700 leading-relaxed">{suggestion.risks}</p>
                </div>
              </div>
            </div>
          )}

          {/* Scores */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Scores
            </h4>
            <div className="space-y-2">
              <ScoreBar label="Capability coverage" value={suggestion.scores.capability} />
              <ScoreBar label="UK ownership" value={suggestion.scores.ukOwnership} />
              <ScoreBar label="Risk profile" value={suggestion.scores.riskProfile} />
              <ScoreBar label="Partnership evidence" value={suggestion.scores.partnershipEvidence} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatAsMarkdown(suggestions: ConsortiumSuggestion[]): string {
  return suggestions
    .map((s, i) => {
      const firmLines = s.firms.map((f) => `- **${f.name}** — ${f.role}`).join("\n");
      const scoreLines = [
        `- Capability coverage: ${Math.round(s.scores.capability * 100)}%`,
        `- UK ownership: ${Math.round(s.scores.ukOwnership * 100)}%`,
        `- Risk profile: ${Math.round(s.scores.riskProfile * 100)}%`,
        `- Partnership evidence: ${Math.round(s.scores.partnershipEvidence * 100)}%`,
      ].join("\n");
      return [
        `## ${i + 1}. ${s.name}`,
        "",
        "### Member Firms",
        firmLines,
        "",
        "### Strategic Rationale",
        s.rationale,
        ...(s.risks ? ["", "### Risks & Red Flags", s.risks] : []),
        "",
        "### Scores",
        scoreLines,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function downloadJson(suggestions: ConsortiumSuggestion[]) {
  const blob = new Blob([JSON.stringify(suggestions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "consortium-suggestions.json";
  a.click();
  URL.revokeObjectURL(url);
}

type ConsortiumResultCardsProps = {
  suggestions: ConsortiumSuggestion[];
  rawText: string;
};

export function ConsortiumResultCards({ suggestions, rawText }: ConsortiumResultCardsProps) {
  function copyRaw() {
    void navigator.clipboard.writeText(rawText).then(() => toast.success("Copied to clipboard"));
  }

  function copyMarkdown() {
    void navigator.clipboard
      .writeText(formatAsMarkdown(suggestions))
      .then(() => toast.success("Copied as markdown"));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-neutral-900">
          {suggestions.length} consortium suggestion{suggestions.length !== 1 ? "s" : ""}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={copyMarkdown}>
            <Copy className="h-3 w-3" /> Copy markdown
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadJson(suggestions)}>
            <Download className="h-3 w-3" /> Export JSON
          </Button>
          <Dialog>
            <DialogTrigger
              render={<Button variant="outline" size="sm" className="h-7 text-xs" />}
            >
              View raw response
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Full LLM response</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto">
                <pre className="text-xs text-neutral-700 whitespace-pre-wrap font-mono leading-relaxed bg-neutral-50 rounded p-4">
                  {rawText}
                </pre>
              </div>
              <Button variant="outline" size="sm" onClick={copyRaw} className="self-end mt-2">
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy raw
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <ConsortiumCard key={i} suggestion={s} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
