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
import { createTopic, updateTopic } from "@/lib/actions/topic-actions";
import type { Topic } from "@/lib/types";

type FormErrors = {
  name?: string;
  form?: string;
};

type TopicFormDialogProps = {
  /** When provided, the dialog operates in edit mode */
  topic?: Topic;
};

export function TopicFormDialog({ topic }: TopicFormDialogProps) {
  const isEditMode = Boolean(topic);

  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [name, setName] = React.useState(topic?.name ?? "");
  const [description, setDescription] = React.useState(topic?.description ?? "");
  const [searchTerms, setSearchTerms] = React.useState(topic?.searchTerms ?? "");
  const [errors, setErrors] = React.useState<FormErrors>({});

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && isEditMode && topic) {
      // Re-seed on open in case topic was updated externally
      setName(topic.name);
      setDescription(topic.description ?? "");
      setSearchTerms(topic.searchTerms ?? "");
      setErrors({});
    } else if (!next) {
      resetForm();
    }
  }

  function resetForm() {
    if (!isEditMode) {
      setName("");
      setDescription("");
      setSearchTerms("");
    }
    setErrors({});
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!name.trim()) {
      next.name = "Topic name is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPending(true);
    setErrors({});

    if (isEditMode && topic) {
      const result = await updateTopic(topic.id, {
        name: name.trim(),
        description: description.trim(),
        searchTerms: searchTerms.trim(),
      });

      setPending(false);

      if (result.ok) {
        toast.success("Changes saved");
        setOpen(false);
      } else {
        setErrors({ form: result.error });
      }
    } else {
      const result = await createTopic({
        name: name.trim(),
        description: description.trim(),
        searchTerms: searchTerms.trim(),
      });

      setPending(false);

      if (result.ok) {
        toast.success("Topic added");
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
      Add Topic
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={defaultTrigger} />

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditMode ? "Edit Topic" : "Add Topic"}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            {isEditMode
              ? "Update this research topic."
              : "Define a research question to investigate for each firm."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Topic name */}
          <div className="space-y-1.5">
            <Label htmlFor="topic-name" className="text-sm">
              Topic Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="topic-name"
              placeholder="e.g. Notable capabilities"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(
                errors.name && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Description / question text */}
          <div className="space-y-1.5">
            <Label htmlFor="topic-description" className="text-sm">
              Description{" "}
              <span className="text-neutral-400 font-normal">(optional)</span>
            </Label>
            <textarea
              id="topic-description"
              placeholder="e.g. What are the notable capabilities and expertise areas of this firm?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Tavily search terms */}
          <div className="space-y-1.5">
            <Label htmlFor="topic-search-terms" className="text-sm">
              Tavily search terms{" "}
              <span className="text-neutral-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="topic-search-terms"
              placeholder="e.g. nuclear capability sites contracts UK"
              value={searchTerms}
              onChange={(e) => setSearchTerms(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-neutral-400">
              Appended after the quoted firm name in each Tavily search. Leave blank to use the topic name.
            </p>
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
              disabled={pending || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {pending
                ? isEditMode ? "Saving..." : "Adding..."
                : isEditMode ? "Save Changes" : "Add Topic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
