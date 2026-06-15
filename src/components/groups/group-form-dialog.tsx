"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { createGroup } from "@/lib/actions/group-actions";

type GroupFormDialogProps = {
  /** Optional custom trigger element (defaults to the "New Group" button) */
  trigger?: React.ReactElement;
};

export function GroupFormDialog({ trigger }: GroupFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  function resetForm() {
    setName("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name is required.");
      return;
    }

    setPending(true);
    setError(null);

    const result = await createGroup(trimmed);
    setPending(false);

    if (result.ok) {
      toast.success("Group created");
      setOpen(false);
      resetForm();
      router.refresh();
    } else {
      setError(result.error ?? "Failed to create group.");
    }
  }

  const defaultTrigger = (
    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
      New Group
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? defaultTrigger} />

      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">New Group</DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            Create a group to organise firms for consortium planning.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-name" className="text-sm">
              Group Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="group-name"
              placeholder="e.g. Nuclear Consortium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(error && "border-red-500 focus-visible:ring-red-500")}
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
          </div>

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
              {pending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
