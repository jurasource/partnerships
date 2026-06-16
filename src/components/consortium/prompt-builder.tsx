"use client";

import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CapabilityMixInput, type CapabilityMix } from "@/components/recommend/capability-mix-input";
import { ConsortiumResultCards } from "@/components/consortium/consortium-result-cards";
import type { LockFirmsListItem } from "@/lib/queries/lock-firms";
import { extractJsonFromLlmText } from "@/lib/consortium/assemble-prompt";
import type { ConsortiumSuggestion } from "@/lib/consortium/types";

type Constraints = {
  ukOwned: boolean;
  noHighRisk: boolean;
  priorNuclear: boolean;
  freeText: string;
};

type IncludeFlags = {
  findings: boolean;
  riskFlags: boolean;
  partnerships: boolean;
  ownership: boolean;
};

const DEFAULT_MIX: CapabilityMix = { Consultancy: 0, Infrastructure: 0, Nuclear: 0 };

const DEFAULT_CONSTRAINTS: Constraints = {
  ukOwned: false,
  noHighRisk: false,
  priorNuclear: false,
  freeText: "",
};

const DEFAULT_INCLUDE: IncludeFlags = {
  findings: true,
  riskFlags: true,
  partnerships: true,
  ownership: true,
};

type PromptBuilderProps = {
  firms: LockFirmsListItem[];
};

export function PromptBuilder({ firms }: PromptBuilderProps) {
  const [opportunityName, setOpportunityName] = useState("");
  const [opportunityDesc, setOpportunityDesc] = useState("");
  const [capabilityMix, setCapabilityMix] = useState<CapabilityMix>(DEFAULT_MIX);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [include, setInclude] = useState<IncludeFlags>(DEFAULT_INCLUDE);

  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState<string>("");
  const [suggestions, setSuggestions] = useState<ConsortiumSuggestion[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const firmIds = firms.map((f) => f.id);
  const canGenerate = opportunityName.trim().length > 0 && firmIds.length > 0;

  function toggleConstraint(key: keyof Omit<Constraints, "freeText">) {
    setConstraints((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleInclude(key: keyof IncludeFlags) {
    setInclude((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function buildBody() {
    return {
      firmIds,
      opportunity: { name: opportunityName.trim(), description: opportunityDesc.trim() },
      capabilityMix,
      constraints,
      include,
    };
  }

  async function handleGenerate() {
    setGenerating(true);
    setSuggestions(null);
    setStreamText("");
    setParseError(null);
    try {
      const res = await fetch("/api/consortium-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        toast.error(json.error ?? "Failed to generate prompt");
        return;
      }
      const data = await res.json() as { prompt: string };
      setGeneratedPrompt(data.prompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRun() {
    if (!generatedPrompt) return;
    setStreaming(true);
    setSuggestions(null);
    setStreamText("");
    setParseError(null);
    try {
      const res = await fetch("/api/consortium-prompt?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok || !res.body) {
        toast.error("Failed to start Claude run");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamText(accumulated);
      }

      // Parse the completed JSON response
      try {
        const jsonStr = extractJsonFromLlmText(accumulated);
        const parsed = JSON.parse(jsonStr) as ConsortiumSuggestion[];
        if (!Array.isArray(parsed)) throw new Error("Response is not an array");
        setSuggestions(parsed);
      } catch {
        setParseError("Could not parse structured suggestions — see full response below.");
        setSuggestions([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Streaming failed");
    } finally {
      setStreaming(false);
    }
  }

  function copyPrompt() {
    if (!generatedPrompt) return;
    void navigator.clipboard.writeText(generatedPrompt).then(() => toast.success("Prompt copied"));
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1: Opportunity */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">1</span>
          <h3 className="font-semibold text-neutral-900">Opportunity</h3>
        </div>
        <div className="space-y-3 pl-8">
          <div className="space-y-1.5">
            <Label htmlFor="opp-name" className="text-sm">Opportunity name</Label>
            <Input
              id="opp-name"
              placeholder="e.g. Sellafield Nuclear Decommissioning Programme"
              value={opportunityName}
              onChange={(e) => setOpportunityName(e.target.value)}
              className="max-w-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opp-desc" className="text-sm">Description <span className="text-neutral-400 font-normal">(optional)</span></Label>
            <textarea
              id="opp-desc"
              placeholder="Describe the contract scope, value, timeline, or any other relevant context..."
              value={opportunityDesc}
              onChange={(e) => setOpportunityDesc(e.target.value)}
              rows={3}
              className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>
      </section>

      {/* Step 2: Requirements */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">2</span>
          <h3 className="font-semibold text-neutral-900">Requirements</h3>
        </div>
        <div className="space-y-5 pl-8">
          <CapabilityMixInput value={capabilityMix} onChange={setCapabilityMix} />

          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">Constraints</p>
            <div className="space-y-2">
              {(
                [
                  { key: "ukOwned", label: "UK-incorporated firms only" },
                  { key: "noHighRisk", label: "Exclude firms with High-severity risk flags" },
                  { key: "priorNuclear", label: "Must have prior nuclear contract history" },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={constraints[key]}
                    onChange={() => toggleConstraint(key)}
                    className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
                  />
                  <span className="text-sm text-neutral-700 group-hover:text-neutral-900">{label}</span>
                </label>
              ))}
            </div>
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="constraints-free" className="text-sm font-normal text-neutral-600">
                Additional constraints
              </Label>
              <textarea
                id="constraints-free"
                placeholder="e.g. Max 4 firms, must include a prime contractor with NDA experience..."
                value={constraints.freeText}
                onChange={(e) => setConstraints((prev) => ({ ...prev, freeText: e.target.value }))}
                rows={2}
                maxLength={500}
                className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Step 3: Firm scope */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">3</span>
          <h3 className="font-semibold text-neutral-900">Firm scope</h3>
        </div>
        <div className="pl-8">
          {firms.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">
              No firms in scope. Select a group above or add firms to the database.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-600">
                <span className="font-medium text-neutral-900">{firms.length}</span> firm
                {firms.length !== 1 ? "s" : ""} will be included in the prompt context.
                {firms.length > 0 && " Use the group selector above to narrow the scope."}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {firms.map((f) => (
                  <Badge key={f.id} variant="secondary" className="text-xs font-normal">
                    {f.canonicalName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Step 4: Data to include */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">4</span>
          <h3 className="font-semibold text-neutral-900">Data to include</h3>
        </div>
        <div className="pl-8 space-y-2">
          {(
            [
              { key: "findings", label: "AI research findings (by topic)" },
              { key: "riskFlags", label: "Risk flags (financial, reputational, regulatory)" },
              { key: "partnerships", label: "Known partnerships and conflicts" },
              { key: "ownership", label: "Ownership records (UK incorporation, parent company)" },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={include[key]}
                onChange={() => toggleInclude(key)}
                className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
              />
              <span className="text-sm text-neutral-700 group-hover:text-neutral-900">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Generate button */}
      <div className="flex gap-3 flex-wrap">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!canGenerate || generating}
          onClick={() => void handleGenerate()}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating prompt…
            </>
          ) : (
            "Generate Prompt"
          )}
        </Button>
        {!canGenerate && (
          <p className="text-sm text-neutral-400 self-center">
            {opportunityName.trim().length === 0
              ? "Enter an opportunity name to continue"
              : "No firms in scope"}
          </p>
        )}
      </div>

      {/* Generated prompt */}
      {generatedPrompt !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Generated prompt</h3>
            <Button variant="outline" size="sm" onClick={copyPrompt} className="h-7 text-xs gap-1.5">
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
          <textarea
            value={generatedPrompt}
            onChange={(e) => setGeneratedPrompt(e.target.value)}
            rows={14}
            className="w-full rounded-md border border-input bg-neutral-50 px-3 py-2.5 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          />
          <Button
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            disabled={streaming}
            onClick={() => void handleRun()}
          >
            {streaming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Claude is thinking…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run with Claude
              </>
            )}
          </Button>
        </div>
      )}

      {/* Streaming in-progress */}
      {streaming && streamText && (
        <div className="rounded-md border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs text-violet-600 font-medium mb-2">Receiving response…</p>
          <pre className="text-xs text-violet-800 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
            {streamText}
          </pre>
        </div>
      )}

      {/* Parse error */}
      {parseError && streamText && (
        <div className="space-y-3">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
            {parseError}
          </p>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 max-h-64 overflow-y-auto">
            <pre className="text-xs text-neutral-700 whitespace-pre-wrap font-mono">{streamText}</pre>
          </div>
        </div>
      )}

      {/* Parsed cards */}
      {suggestions !== null && suggestions.length > 0 && (
        <ConsortiumResultCards suggestions={suggestions} rawText={streamText} />
      )}
    </div>
  );
}
