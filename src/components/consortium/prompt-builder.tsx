"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Copy, Eye, Loader2, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ConsortiumResultCards } from "@/components/consortium/consortium-result-cards";
import type { LockFirmsListItem } from "@/lib/queries/lock-firms";
import { extractJsonFromLlmText } from "@/lib/consortium/assemble-prompt";
import type { ConsortiumSuggestion, RoleSlot } from "@/lib/consortium/types";

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

const DEFAULT_ROLES: RoleSlot[] = [
  {
    id: "role-1",
    title: "Prime contractor",
    description: "Holds the contract; proven programme delivery at scale; ideally an existing NDA relationship and track record on major civil nuclear programmes.",
  },
  {
    id: "role-2",
    title: "Technical specialist",
    description: "Deep civil nuclear expertise in the target area (e.g. decommissioning, new build, fuel cycle); can be an SME.",
  },
  {
    id: "role-3",
    title: "Compliance & assurance",
    description: "Nuclear safety case authorship, ONR/EA regulatory engagement, SQEP workforce supply.",
  },
];

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

function PromptMarkdown({ content }: { content: string }) {
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKeyBase = 0;

  function flushList(idx: number) {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${idx}-${listKeyBase++}`} className="list-disc ml-4 space-y-0.5 my-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-neutral-700 leading-snug">{item}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  }

  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    if (line.startsWith("## ")) {
      flushList(idx);
      elements.push(
        <h2 key={idx} className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-5 mb-2 pb-1 border-b border-neutral-200 first:mt-0">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushList(idx);
      elements.push(
        <h3 key={idx} className="text-sm font-semibold text-neutral-800 mt-3 mb-0.5">
          {line.slice(4)}
        </h3>,
      );
    } else if (/^\s*-\s/.test(line)) {
      listItems.push(line.replace(/^\s*-\s/, ""));
    } else if (line.trim() === "") {
      flushList(idx);
    } else {
      flushList(idx);
      elements.push(
        <p key={idx} className="text-sm text-neutral-700 leading-relaxed">
          {line}
        </p>,
      );
    }
  });
  flushList(lines.length);

  return <div className="space-y-0.5">{elements}</div>;
}

const CAPABILITY_COLORS: Record<string, string> = {
  Nuclear: "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Consultancy: "bg-violet-100 text-violet-700 border-violet-200",
};

type PromptBuilderProps = {
  allFirms: LockFirmsListItem[];
  initialFirms: LockFirmsListItem[];
};

export function PromptBuilder({ allFirms, initialFirms }: PromptBuilderProps) {
  const [opportunityName, setOpportunityName] = useState("");
  const [opportunityDesc, setOpportunityDesc] = useState("");
  const [roles, setRoles] = useState<RoleSlot[]>(DEFAULT_ROLES);
  const [anchorFirmId, setAnchorFirmId] = useState<string | null>(null);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [include, setInclude] = useState<IncludeFlags>(DEFAULT_INCLUDE);

  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<"view" | "run" | null>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runPhase, setRunPhase] = useState<"setup" | "running">("setup");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");

  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState<string>("");
  const [suggestions, setSuggestions] = useState<ConsortiumSuggestion[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [selectedFirmIds, setSelectedFirmIds] = useState<Set<string>>(
    () => new Set(initialFirms.map((f) => f.id)),
  );
  const [firmSearch, setFirmSearch] = useState("");

  // Sync selection when group scope changes
  useEffect(() => {
    setSelectedFirmIds(new Set(initialFirms.map((f) => f.id)));
  }, [initialFirms]);

  const filteredFirms = useMemo(() => {
    const q = firmSearch.trim().toLowerCase();
    if (!q) return allFirms;
    return allFirms.filter(
      (f) =>
        f.canonicalName.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allFirms, firmSearch]);

  const firmIds = useMemo(() => [...selectedFirmIds], [selectedFirmIds]);
  const canGenerate =
    opportunityName.trim().length > 0 &&
    selectedFirmIds.size > 0 &&
    roles.some((r) => r.title.trim().length > 0);

  // Clear anchor if the anchored firm is removed from scope
  useEffect(() => {
    if (anchorFirmId && !selectedFirmIds.has(anchorFirmId)) {
      setAnchorFirmId(null);
    }
  }, [anchorFirmId, selectedFirmIds]);

  // Invalidate cached prompt when any form input changes
  useEffect(() => {
    setGeneratedPrompt(null);
  }, [opportunityName, opportunityDesc, roles, anchorFirmId, constraints, include, selectedFirmIds]);

  function toggleFirm(firmId: string) {
    setSelectedFirmIds((prev) => {
      const next = new Set(prev);
      if (next.has(firmId)) next.delete(firmId);
      else next.add(firmId);
      return next;
    });
  }

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
      roles: roles.filter((r) => r.title.trim()),
      anchorFirmId,
      constraints,
      include,
    };
  }

  function addRole() {
    setRoles((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "", description: "" },
    ]);
  }

  function removeRole(id: string) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRole(id: string, field: "title" | "description", value: string) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function ensurePrompt(): Promise<string | null> {
    if (generatedPrompt) return generatedPrompt;
    try {
      const res = await fetch("/api/consortium-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        toast.error(json.error ?? "Failed to generate prompt");
        return null;
      }
      const data = await res.json() as { prompt: string };
      setGeneratedPrompt(data.prompt);
      return data.prompt;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      return null;
    }
  }

  async function handleViewPrompt() {
    setGeneratingFor("view");
    try {
      const prompt = await ensurePrompt();
      if (prompt) setPromptModalOpen(true);
    } finally {
      setGeneratingFor(null);
    }
  }

  async function handleOpenRunModal() {
    setGeneratingFor("run");
    try {
      const prompt = await ensurePrompt();
      if (prompt) {
        setRunPhase("setup");
        setRunModalOpen(true);
      }
    } finally {
      setGeneratingFor(null);
    }
  }

  async function handleStartRun() {
    setRunPhase("running");
    setStreaming(true);
    setSuggestions(null);
    setStreamText("");
    setParseError(null);
    try {
      const res = await fetch("/api/consortium-prompt?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildBody(), model: selectedModel }),
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
      setRunModalOpen(false);
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

      {/* Step 2: Roles */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">2</span>
          <h3 className="font-semibold text-neutral-900">Roles</h3>
        </div>
        <div className="space-y-5 pl-8">

          {/* Role slots */}
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">
              Define the roles the consortium must fill. The AI will assign firms to each role based on their profiles.
            </p>
            {roles.map((role, idx) => (
              <div key={role.id} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5 border border-neutral-200 rounded-lg p-3 bg-neutral-50/50">
                  <Input
                    placeholder="Role title, e.g. Prime contractor"
                    value={role.title}
                    onChange={(e) => updateRole(role.id, "title", e.target.value)}
                    className="h-8 text-sm font-medium bg-white"
                  />
                  <textarea
                    placeholder="What this role must bring — skills, accreditations, relationships, size…"
                    value={role.description}
                    onChange={(e) => updateRole(role.id, "description", e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRole(role.id)}
                  disabled={roles.length === 1}
                  className="mt-3 text-neutral-300 hover:text-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Remove role ${idx + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {roles.length < 8 && (
              <button
                type="button"
                onClick={addRole}
                className="text-sm text-blue-600 hover:underline"
              >
                + Add role
              </button>
            )}
          </div>

          {/* Anchor firm */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-neutral-700">
              Anchor firm <span className="text-neutral-400 font-normal">(optional)</span>
            </Label>
            <p className="text-xs text-neutral-500">
              Pin one firm as the lead. The AI will build the rest of the consortium to complement them.
            </p>
            <Select
              value={anchorFirmId ?? "__none__"}
              onValueChange={(v) => setAnchorFirmId(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-9 text-sm max-w-xs">
                <span className={anchorFirmId ? "text-foreground" : "text-muted-foreground"}>
                  {anchorFirmId
                    ? (allFirms.find((f) => f.id === anchorFirmId)?.canonicalName ?? "Unknown firm")
                    : "None — AI chooses lead"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None — AI chooses lead</SelectItem>
                {allFirms
                  .filter((f) => selectedFirmIds.has(f.id))
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.canonicalName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Constraints */}
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
                placeholder="e.g. Max 4 firms in the consortium…"
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
        <div className="pl-8 space-y-3">
          {allFirms.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">No firms in the database yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-neutral-600">
                  <span className="font-medium text-neutral-900">{selectedFirmIds.size}</span>
                  {" of "}
                  <span className="font-medium text-neutral-900">{allFirms.length}</span>
                  {" firm"}
                  {allFirms.length !== 1 ? "s" : ""} selected
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFirmIds(new Set(allFirms.map((f) => f.id)))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFirmIds(new Set())}
                    className="text-xs text-neutral-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-neutral-50">
                  <Search className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search firms or capabilities…"
                    value={firmSearch}
                    onChange={(e) => setFirmSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                  />
                  {firmSearch && (
                    <button type="button" onClick={() => setFirmSearch("")}>
                      <X className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600" />
                    </button>
                  )}
                </div>

                {/* Firm list */}
                <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100">
                  {filteredFirms.length === 0 ? (
                    <p className="text-sm text-neutral-400 italic px-3 py-4">No firms match your search.</p>
                  ) : (
                    filteredFirms.map((firm) => {
                      const isSelected = selectedFirmIds.has(firm.id);
                      return (
                        <label
                          key={firm.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-neutral-50 transition-colors",
                            isSelected && "bg-blue-50/50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFirm(firm.id)}
                            className="h-4 w-4 rounded border-neutral-300 accent-blue-600 shrink-0"
                          />
                          <span className={cn("text-sm flex-1", isSelected ? "font-medium text-neutral-900" : "text-neutral-600")}>
                            {firm.canonicalName}
                          </span>
                          {firm.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {firm.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={cn(
                                    "text-xs px-1.5 py-0.5 rounded border font-normal",
                                    CAPABILITY_COLORS[tag] ?? "bg-neutral-100 text-neutral-600 border-neutral-200",
                                  )}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </>
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

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap items-center">
        <Button
          variant="outline"
          disabled={!canGenerate || generatingFor !== null}
          onClick={() => void handleViewPrompt()}
          className="gap-1.5"
        >
          {generatingFor === "view" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          View Prompt
        </Button>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
          disabled={!canGenerate || generatingFor !== null}
          onClick={() => void handleOpenRunModal()}
        >
          {generatingFor === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Run with Claude
        </Button>
        {!canGenerate && (
          <p className="text-sm text-neutral-400">
            {opportunityName.trim().length === 0
              ? "Enter an opportunity name to continue"
              : !roles.some((r) => r.title.trim())
              ? "Add at least one role title to continue"
              : "No firms in scope"}
          </p>
        )}
      </div>

      {/* Prompt preview modal */}
      <Dialog open={promptModalOpen} onOpenChange={setPromptModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] flex flex-col" showCloseButton>
          <DialogHeader className="shrink-0">
            <DialogTitle>Generated Prompt</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto mt-1 pr-1">
            {generatedPrompt && <PromptMarkdown content={generatedPrompt} />}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={copyPrompt} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copy raw markdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run modal */}
      <Dialog open={runModalOpen} onOpenChange={(open) => { if (!streaming) setRunModalOpen(open); }}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] flex flex-col" showCloseButton={!streaming}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{runPhase === "running" ? "Claude is thinking…" : "Run with Claude"}</DialogTitle>
          </DialogHeader>

          {runPhase === "setup" && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto mt-1 pr-1">
                {generatedPrompt && <PromptMarkdown content={generatedPrompt} />}
              </div>
              <div className="shrink-0 space-y-2 pt-3 border-t border-neutral-100">
                <p className="text-sm font-medium text-neutral-700">Model</p>
                <div className="flex flex-col gap-2">
                  {([
                    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", note: "Balanced — recommended" },
                    { id: "claude-opus-4-8", label: "Opus 4.8", note: "Most capable, slower" },
                    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", note: "Fastest" },
                  ] as const).map((m) => (
                    <label key={m.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="run-model"
                        value={m.id}
                        checked={selectedModel === m.id}
                        onChange={() => setSelectedModel(m.id)}
                        className="accent-violet-600"
                      />
                      <span className="text-sm font-medium text-neutral-900">{m.label}</span>
                      <span className="text-xs text-neutral-400">{m.note}</span>
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter className="shrink-0">
                <Button variant="outline" onClick={() => setRunModalOpen(false)}>Cancel</Button>
                <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2" onClick={() => void handleStartRun()}>
                  <Sparkles className="h-4 w-4" /> Run
                </Button>
              </DialogFooter>
            </>
          )}

          {runPhase === "running" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-neutral-600">Generating consortium suggestions…</p>
              {streamText && (
                <p className="text-xs text-neutral-400">{streamText.length.toLocaleString()} characters received</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
