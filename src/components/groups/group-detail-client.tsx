"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateGroup, addFirmToGroup, removeFirmFromGroup } from "@/lib/actions/group-actions";

type FirmEntry = {
  id: string;
  canonicalName: string;
};

type GroupDetailClientProps = {
  groupId: string;
  groupName: string;
  memberFirms: FirmEntry[];
  nonMemberFirms: FirmEntry[];
};

export function GroupDetailClient({
  groupId,
  groupName,
  memberFirms,
  nonMemberFirms,
}: GroupDetailClientProps) {
  const router = useRouter();

  // ── Inline rename state ──────────────────────────────────────────────────
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(groupName);
  const [saving, setSaving] = React.useState(false);

  async function handleSaveName() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    const result = await updateGroup(groupId, trimmed);
    setSaving(false);
    if (result.ok) {
      toast.success("Group renamed");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to rename group");
    }
  }

  function handleCancelEdit() {
    setDraft(groupName);
    setEditing(false);
  }

  // ── Remove firm ──────────────────────────────────────────────────────────
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  async function handleRemoveFirm(firmId: string) {
    setRemovingId(firmId);
    const result = await removeFirmFromGroup(firmId, groupId);
    setRemovingId(null);
    if (result.ok) {
      toast.success("Firm removed from group");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to remove firm");
    }
  }

  // ── Add firm picker ──────────────────────────────────────────────────────
  const [addingId, setAddingId] = React.useState<string | null>(null);

  async function handleAddFirm(firmId: string) {
    if (!firmId) return;
    setAddingId(firmId);
    const result = await addFirmToGroup(firmId, groupId);
    setAddingId(null);
    if (result.ok) {
      toast.success("Firm added to group");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to add firm");
    }
  }

  const allInGroup = nonMemberFirms.length === 0;

  return (
    <div className="space-y-8">
      {/* ── Group name / inline rename ────────────────────────────────────── */}
      <section>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="text-2xl font-semibold max-w-sm h-10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") handleCancelEdit();
              }}
            />
            <Button
              size="sm"
              onClick={handleSaveName}
              disabled={saving || !draft.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-neutral-900">
              {groupName}
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setDraft(groupName);
                setEditing(true);
              }}
              aria-label="Rename group"
            >
              <Pencil className="h-4 w-4 text-neutral-500" />
            </Button>
          </div>
        )}
      </section>

      {/* ── Member firms ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
          Member Firms
        </h3>
        {memberFirms.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">
            No firms in this group yet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white overflow-hidden">
            {memberFirms.map((firm) => (
              <li
                key={firm.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium text-neutral-800">
                  {firm.canonicalName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFirm(firm.id)}
                  disabled={removingId === firm.id}
                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {removingId === firm.id ? "Removing..." : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Add firm picker ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
          Add Firm
        </h3>
        {allInGroup ? (
          <p className="text-sm text-neutral-400 italic">
            All firms are already in this group.
          </p>
        ) : (
          <div className="flex items-center gap-3 max-w-sm">
            <Select
              onValueChange={(value: string | null) => { if (value) handleAddFirm(value); }}
              disabled={Boolean(addingId)}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Select a firm to add…" />
              </SelectTrigger>
              <SelectContent>
                {nonMemberFirms.map((firm) => (
                  <SelectItem key={firm.id} value={firm.id}>
                    {firm.canonicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {addingId && (
              <span className="text-sm text-neutral-400">Adding…</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
