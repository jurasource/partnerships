"use client";

import * as React from "react";
import { toast } from "sonner";

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
import { ChSearchField } from "@/components/firms/ch-search-field";
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

type FormErrors = {
  canonicalName?: string;
  companiesHouseNumber?: string;
  form?: string;
};

type FirmFormDialogProps = {
  /** When provided, the dialog operates in edit mode */
  firm?: Firm;
  /** Optional custom trigger element (defaults to the Add/Edit Firm button) */
  trigger?: React.ReactElement;
};

export function FirmFormDialog({ firm, trigger }: FirmFormDialogProps) {
  const isEditMode = Boolean(firm);

  // Parse existing tags from JSON if editing
  const initialTags: CapabilityTag[] = React.useMemo(() => {
    if (!firm) return [];
    try {
      return JSON.parse(firm.capabilityTags as string) as CapabilityTag[];
    } catch {
      return [];
    }
  }, [firm]);

  const initialAliases: string = React.useMemo(() => {
    if (!firm) return "";
    try {
      const parsed = JSON.parse(firm.aliases as string) as string[];
      return parsed.join(", ");
    } catch {
      return "";
    }
  }, [firm]);

  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // Form state — seeded from firm prop when in edit mode
  const [canonicalName, setCanonicalName] = React.useState(firm?.canonicalName ?? "");
  const [aliasesRaw, setAliasesRaw] = React.useState(initialAliases);
  const [chNumber, setChNumber] = React.useState(firm?.companiesHouseNumber ?? "");
  const [selectedTags, setSelectedTags] = React.useState<CapabilityTag[]>(initialTags);
  const [errors, setErrors] = React.useState<FormErrors>({});

  // When the dialog opens in edit mode, re-seed the form from current firm data
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && isEditMode && firm) {
      setCanonicalName(firm.canonicalName);
      setAliasesRaw(initialAliases);
      setChNumber(firm.companiesHouseNumber ?? "");
      setSelectedTags(initialTags);
      setErrors({});
    } else if (!next) {
      resetForm();
    }
  }

  function resetForm() {
    if (!isEditMode) {
      setCanonicalName("");
      setAliasesRaw("");
      setChNumber("");
      setSelectedTags([]);
    }
    setErrors({});
  }

  function toggleTag(tag: CapabilityTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!canonicalName.trim()) {
      next.canonicalName = "Firm name is required.";
    }
    if (!chNumber.trim()) {
      next.companiesHouseNumber = "Companies House number is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPending(true);
    setErrors({});

    const aliases = aliasesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (isEditMode && firm) {
      // Edit mode — call updateFirm
      const result = await updateFirm(firm.id, {
        canonicalName: canonicalName.trim(),
        aliases,
        companiesHouseNumber: chNumber.trim(),
        capabilityTags: selectedTags,
      });

      setPending(false);

      if (result.ok) {
        toast.success("Changes saved");
        setOpen(false);
      } else {
        setErrors({ form: result.error });
      }
    } else {
      // Add mode — call createFirm
      const result = await createFirm({
        canonicalName: canonicalName.trim(),
        aliases,
        companiesHouseNumber: chNumber.trim(),
        capabilityTags: selectedTags,
      });

      setPending(false);

      if (result.ok) {
        toast.success("Firm added");
        setOpen(false);
        resetForm();
      } else {
        setErrors({ form: result.error });
      }
    }
  }

  const defaultTrigger = isEditMode ? (
    <Button variant="ghost" size="sm" className="h-8 px-2 text-neutral-600 hover:text-neutral-900">
      Edit
    </Button>
  ) : (
    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
      Add Firm
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? defaultTrigger} />

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditMode ? "Edit Firm" : "Add Firm"}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            {isEditMode
              ? "Update this firm's details. Companies House numbers are always editable."
              : "Add a firm to your intelligence list. Enter the Companies House number directly or search for it."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Canonical name */}
          <div className="space-y-1.5">
            <Label htmlFor="canonical-name" className="text-sm">
              Firm Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="canonical-name"
              placeholder="e.g. AtkinsRéalis"
              value={canonicalName}
              onChange={(e) => setCanonicalName(e.target.value)}
              className={cn(
                errors.canonicalName &&
                  "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {errors.canonicalName && (
              <p className="text-xs text-red-600">{errors.canonicalName}</p>
            )}
          </div>

          {/* Aliases */}
          <div className="space-y-1.5">
            <Label htmlFor="aliases" className="text-sm">
              Aliases{" "}
              <span className="text-neutral-400 font-normal">
                (comma-separated)
              </span>
            </Label>
            <Input
              id="aliases"
              placeholder="e.g. SNC-Lavalin, Atkins"
              value={aliasesRaw}
              onChange={(e) => setAliasesRaw(e.target.value)}
            />
          </div>

          {/* Companies House number */}
          <div className="space-y-1.5">
            <Label htmlFor="ch-number" className="text-sm">
              Companies House Number{" "}
              <span className="text-red-600">*</span>
            </Label>
            {/* Live Companies House search (D-03) — auto-fills the CH number */}
            <ChSearchField
              value={chNumber}
              onChange={setChNumber}
              error={Boolean(errors.companiesHouseNumber)}
            />
            {errors.companiesHouseNumber && (
              <p className="text-xs text-red-600">
                {errors.companiesHouseNumber}
              </p>
            )}
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
                      isSelected ? styles.selected : styles.unselected
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form-level error */}
          {errors.form && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {errors.form}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !canonicalName.trim() || !chNumber.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {pending
                ? isEditMode
                  ? "Saving..."
                  : "Adding..."
                : isEditMode
                ? "Save Changes"
                : "Add Firm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
