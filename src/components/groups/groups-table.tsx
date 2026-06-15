"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteGroup } from "@/lib/actions/group-actions";

type GroupRow = {
  id: string;
  name: string;
  firmCount: number;
};

type GroupsTableProps = {
  data: GroupRow[];
};

function FirmCountLabel({ count }: { count: number }) {
  if (count === 0) return <span className="text-neutral-400">No firms</span>;
  if (count === 1) return <span>1 firm</span>;
  return <span>{count} firms</span>;
}

function GroupRowActions({ group }: { group: GroupRow }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteGroup(group.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (result.ok) {
      toast.success(`"${group.name}" deleted`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete group");
    }
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <Link
        href={`/groups/${group.id}`}
        className="inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
      >
        View
      </Link>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            />
          }
        >
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete group? This removes the group and its firm memberships, but
              not the firms themselves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function GroupsTable({ data }: GroupsTableProps) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white overflow-hidden">
      <Table className="table-fixed w-full">
        <TableHeader className="bg-neutral-50">
          <TableRow className="border-neutral-200">
            <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide py-3">
              Group Name
            </TableHead>
            <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide py-3 w-32">
              Firms
            </TableHead>
            <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide py-3 w-40">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((group) => (
            <TableRow
              key={group.id}
              className="border-neutral-100 hover:bg-neutral-50 transition-colors"
            >
              <TableCell className="py-3 text-sm">
                <Link
                  href={`/groups/${group.id}`}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {group.name}
                </Link>
              </TableCell>
              <TableCell className="py-3 text-sm text-neutral-600">
                <FirmCountLabel count={group.firmCount} />
              </TableCell>
              <TableCell className="py-3">
                <GroupRowActions group={group} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
