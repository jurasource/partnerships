"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createFirm, updateFirm } from "@/lib/actions/firm-actions";
import { refreshChAliasesAction } from "@/lib/actions/ch-search-actions";
import { generateAliasesAction } from "@/lib/actions/alias-actions";
import { ChSearchStep } from "@/components/firms/ch-search-field";
import { AliasChips } from "@/components/firms/alias-chips";
import type { CompanyProfile } from "@/lib/clients/companies-house";
import type { CapabilityTag, Firm } from "@/lib/types";

const ALL_TAGS: CapabilityTag[] = ["Nuclear", "Infrastructure", "Consultancy"];

const TAG_STYLES: Record<CapabilityTag, { selected: string; unselected: string }> = {
  Nuclear: {
    selected: "bg-amber-100 text-amber-700 border-amber-300",
    unselected:
      "bg-white text-neutral-500 border-neutral-300 hover:border-amber-300 hover:text-amber-600",
  },
  Infrastructure: {
    selected: "bg-sky-100 text-sky-700 border-sky-300",
    unselected:
      "bg-white text-neutral-500 border-neutral-300 hover:border-sky-300 hover:text-sky-600",
  },
  Consultancy: {
    selected: "bg-violet-100 text-violet-700 border-violet-300",
    unselected:
      "bg-white text-neutral-500 border-neutral-300 hover:border-violet-300 hover:text-violet-600",
  },
};

type FirmFormDialogProps = {
  firm?: Firm;
  trigger?: React.ReactElement;
  defaultName?: string;
  onSuccess?: () => void;
};

export function FirmFormDialog({ firm, trigger, defaultName, onSuccess }: FirmFormDialogProps) {
  const isEditMode = Boolean(firm);

  const initialTags = React.useMemo<CapabilityTag[]>(() => {
    if (!firm) return [];
    try {
      return JSON.parse(firm.capabilityTags as string) as CapabilityTag[];
    } catch {
      return [];
    }
  }, [firm]);

  const initialAliases = React.useMemo<string[]>(() => {
    if (!firm) return [];
    try {
      return JSON.parse(firm.aliases as string) as string[];
    } catch {
      return [];
    }
  }, [firm]);

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2>(1);

  // Step 1 state
  const [selectedProfile, setSelectedProfile] = React.useState<CompanyProfile | null>(null);

  // Step 2 state
  const [canonicalName, setCanonicalName] = React.useState(firm?.canonicalName ?? defaultName ?? "");
  const [aliases, setAliases] = React.useState<string[]>(initialAliases);
  const [selectedTags, setSelectedTags] = React.useState<CapabilityTag[]>(initialTags);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Alias action state
  const [refreshingAliases, setRefreshingAliases] = React.useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = React.useState(false);
  const [aliasSuggestions, setAliasSuggestions] = React.useState<string[]>([]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Reset to Step 1 on open
      setStep(1);
      setSelectedProfile(null);
      setAliasSuggestions([]);
      setFormError(null);
      setNameError(null);

      if (isEditMode && firm) {
        setCanonicalName(firm.canonicalName);
        setAliases(initialAliases);
        setSelectedTags(initialTags);
      } else {
        setCanonicalName(defaultName ?? "");
        setAliases([]);
        setSelectedTags([]);
      }
    }
  }

  function seedStep2FromProfile(profile: CompanyProfile) {
    // Pre-fill canonical name from CH registered name
    setCanonicalName(profile.company_name);

    // Seed aliases: registered name + previous company names, deduplicated
    const previousNames = (profile.previous_company_names ?? []).map((p) => p.name);
    const seeded = [profile.company_name, ...previousNames].filter(
      (n, i, arr) => arr.indexOf(n) === i,
    );
    setAliases(seeded);
  }

  function handleNext() {
    if (!selectedProfile) return;
    seedStep2FromProfile(selectedProfile);
    setAliasSuggestions([]);
    setStep(2);
  }

  async function handleRefreshAliases() {
    const chNumber = selectedProfile?.company_number ?? firm?.companiesHouseNumber;
    if (!chNumber) return;

    setRefreshingAliases(true);
    const res = await refreshChAliasesAction(chNumber);
    setRefreshingAliases(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    const incoming = [res.registeredName, ...res.previousNames];
    const merged = [...aliases];
    for (const name of incoming) {
      if (name && !merged.includes(name)) merged.push(name);
    }
    setAliases(merged);
    toast.success("Aliases refreshed from Companies House");
  }

  async function handleGenerateSuggestions() {
    const chNumber = selectedProfile?.company_number ?? firm?.companiesHouseNumber;
    const registeredName = selectedProfile?.company_name ?? firm?.canonicalName ?? canonicalName;

    setGeneratingSuggestions(true);
    const res = await generateAliasesAction(canonicalName, registeredName, aliases);
    setGeneratingSuggestions(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    // Only show suggestions not already in the alias list
    const novel = res.suggestions.filter((s) => !aliases.includes(s));
    setAliasSuggestions(novel);
    if (novel.length === 0) toast.info("No new suggestions — aliases look complete");
  }

  function acceptSuggestion(s: string) {
    if (!aliases.includes(s)) setAliases([...aliases, s]);
    setAliasSuggestions(aliasSuggestions.filter((x) => x !== s));
  }

  function rejectSuggestion(s: string) {
    setAliasSuggestions(aliasSuggestions.filter((x) => x !== s));
  }

  function toggleTag(tag: CapabilityTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canonicalName.trim()) {
      setNameError("Firm name is required.");
      return;
    }
    const chNumber =
      selectedProfile?.company_number ?? firm?.companiesHouseNumber ?? "";
    if (!chNumber) {
      setFormError("No Companies House number selected.");
      return;
    }

    setPending(true);
    setNameError(null);
    setFormError(null);

    if (isEditMode && firm) {
      const result = await updateFirm(firm.id, {
        canonicalName: canonicalName.trim(),
        aliases,
        companiesHouseNumber: chNumber,
        capabilityTags: selectedTags,
      });
      setPending(false);
      if (result.ok) {
        toast.success("Changes saved");
        setOpen(false);
      } else {
        setFormError(result.error);
      }
    } else {
      const result = await createFirm({
        canonicalName: canonicalName.trim(),
        aliases,
        companiesHouseNumber: chNumber,
        capabilityTags: selectedTags,
      });
      setPending(false);
      if (result.ok) {
        toast.success("Firm added");
        setOpen(false);
        onSuccess?.();
      } else {
        setFormError(result.error);
      }
    }
  }

  const defaultTrigger = isEditMode ? (
    <Button variant="ghost" size="sm" className="h-8 px-2 text-neutral-600 hover:text-neutral-900">
      Edit Firm
    </Button>
  ) : (
    <Button className="bg-blue-600 hover:bg-blue-700 text-white">Add Firm</Button>
  );

  const hasChForRefresh =
    Boolean(selectedProfile?.company_number) || Boolean(firm?.companiesHouseNumber);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? defaultTrigger} />

      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditMode ? "Edit Firm" : "Add Firm"}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            {step === 1
              ? isEditMode
                ? "Confirm or update the Companies House registration, then click Next."
                : "Search Companies House to find and verify the firm, then click Next."
              : isEditMode
              ? "Update firm details. Use Refresh to pull latest CH names."
              : "Review and confirm firm details before saving."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span
            className={cn(
              "font-medium",
              step === 1 ? "text-blue-600" : "text-neutral-400",
            )}
          >
            1 · Companies House
          </span>
          <span>/</span>
          <span
            className={cn(
              "font-medium",
              step === 2 ? "text-blue-600" : "text-neutral-400",
            )}
          >
            2 · Firm Details
          </span>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-4 py-1">
            <ChSearchStep
              defaultChNumber={firm?.companiesHouseNumber ?? undefined}
              onSelect={setSelectedProfile}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!selectedProfile}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next →
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5 py-1">
            {/* Canonical name */}
            <div className="space-y-1.5">
              <Label htmlFor="canonical-name" className="text-sm">
                Firm Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="canonical-name"
                placeholder="e.g. AtkinsRéalis"
                value={canonicalName}
                onChange={(e) => {
                  setCanonicalName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                className={cn(nameError && "border-red-500 focus-visible:ring-red-500")}
              />
              {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            </div>

            {/* Aliases */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Aliases</Label>
                <div className="flex items-center gap-2">
                  {hasChForRefresh && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshAliases}
                      disabled={refreshingAliases}
                      className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-800"
                    >
                      {refreshingAliases ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Refresh from CH
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateSuggestions}
                    disabled={generatingSuggestions}
                    className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-800"
                  >
                    {generatingSuggestions ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    AI Suggest
                  </Button>
                </div>
              </div>
              <AliasChips
                aliases={aliases}
                onChange={setAliases}
                suggestions={aliasSuggestions}
                onAcceptSuggestion={acceptSuggestion}
                onRejectSuggestion={rejectSuggestion}
              />
            </div>

            {/* Capability tags */}
            <div className="space-y-1.5">
              <Label className="text-sm">Capability Tags</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  const styles = TAG_STYLES[tag];
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                        isSelected ? styles.selected : styles.unselected,
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form-level error */}
            {formError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={pending}
              >
                ← Back
              </Button>
              <Button
                type="submit"
                disabled={pending || !canonicalName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {pending
                  ? isEditMode
                    ? "Saving…"
                    : "Adding…"
                  : isEditMode
                  ? "Save Changes"
                  : "Add Firm"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
