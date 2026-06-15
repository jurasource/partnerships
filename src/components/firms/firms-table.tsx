"use client";

import * as React from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { deleteFirm } from "@/lib/actions/firm-actions";
import { FirmFormDialog } from "@/components/firms/firm-form-dialog";
import { FirmRowRefresh } from "@/components/firms/firm-row-refresh";
import { FirmRowResearch } from "@/components/firms/firm-row-research";
import { FirmRowCHRefresh } from "@/components/firms/firm-row-ch-refresh";
import { StalenessBadge } from "@/components/research/staleness-badge";
import { FirmsFilterBar } from "@/components/firms/firms-filter-bar";
import { useFirmFilters } from "@/hooks/use-firm-filters";
import type { Firm, CapabilityTag, FirmWithGroups } from "@/lib/types";

export type { FirmWithGroups };

// ---------------------------------------------------------------------------
// Badge styling per capability tag (UI-SPEC Color section)
// ---------------------------------------------------------------------------
const TAG_STYLES: Record<CapabilityTag, string> = {
  Nuclear: "bg-rose-50 text-rose-700 border-rose-200",
  Infrastructure: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Consultancy: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function CapabilityBadge({ tag }: { tag: string }) {
  const style = TAG_STYLES[tag as CapabilityTag] ?? "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-normal px-1.5 py-0.5 border", style)}
    >
      {tag}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Row actions: Edit + Delete (+ space reserved for Plan 03 Refresh)
// ---------------------------------------------------------------------------
function FirmRowActions({ firm }: { firm: Firm }) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteFirm(firm.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (result.ok) {
      toast.success(`${firm.canonicalName} deleted`);
    } else {
      toast.error(result.error ?? "Failed to delete firm");
    }
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {/* Per-firm refresh — re-fetches CH/CF/FTS into the cache (Plan 03) */}
      <FirmRowRefresh firmId={firm.id} firmName={firm.canonicalName} />

      {/* CH refresh — fetches fresh CH snapshot and re-derives ownership fields */}
      <FirmRowCHRefresh
        firmId={firm.id}
        firmName={firm.canonicalName}
        companiesHouseNumber={firm.companiesHouseNumber}
      />

      {/* Edit — opens FirmFormDialog in edit mode */}
      <FirmFormDialog firm={firm} />

      {/* Delete — AlertDialog destructive (UI-SPEC copy, T-01-06) */}
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
            <AlertDialogTitle>Delete firm?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {firm.canonicalName} and its cached procurement and research
              data? This can&apos;t be undone.
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

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
function buildColumns(): ColumnDef<FirmWithGroups>[] {
  return [
    {
      accessorKey: "canonicalName",
      header: "Firm",
      cell: ({ row }) => (
        <Link
          href={`/firms/${row.original.id}`}
          className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          {row.getValue("canonicalName")}
        </Link>
      ),
    },
    {
      id: "capabilityTags",
      header: "Capabilities",
      accessorFn: (row) => {
        try {
          return JSON.parse(row.capabilityTags as string) as string[];
        } catch {
          return [];
        }
      },
      cell: ({ getValue }) => {
        const tags = getValue() as string[];
        if (!tags.length) {
          return (
            <span className="text-sm text-neutral-400 italic">None</span>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <CapabilityBadge key={tag} tag={tag} />
            ))}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "groups",
      header: "Groups",
      enableSorting: false,
      cell: ({ row }) => {
        const firmGroups = row.original.groups;
        if (!firmGroups.length) {
          return (
            <span className="text-sm text-neutral-400 italic">None</span>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            {firmGroups.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`}>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-normal px-1.5 py-0.5 border cursor-pointer",
                    "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  )}
                >
                  {g.name}
                </Badge>
              </Link>
            ))}
          </div>
        );
      },
    },
    {
      id: "research",
      header: "Research",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <StalenessBadge lastResearchedAt={row.original.lastResearchedAt} />
          <FirmRowResearch
            firmId={row.original.id}
            firmName={row.original.canonicalName}
            companiesHouseNumber={row.original.companiesHouseNumber}
          />
        </div>
      ),
    },
    {
      accessorKey: "companiesHouseNumber",
      header: () => (
        <span className="block text-right">CH Number</span>
      ),
      cell: ({ row }) => {
        const num = row.getValue("companiesHouseNumber") as string | null;
        return (
          <span
            className={cn(
              "block text-right text-sm font-mono",
              num ? "text-neutral-700" : "text-neutral-400 italic"
            )}
          >
            {num ?? "—"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <FirmRowActions firm={row.original} />,
      enableSorting: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Known capability tags (data-driven per Pitfall 10; these are the seed values)
// ---------------------------------------------------------------------------
const ALL_CAPABILITIES: string[] = ["Nuclear", "Infrastructure", "Consultancy"];

// ---------------------------------------------------------------------------
// FirmsTable component
// ---------------------------------------------------------------------------
type FirmsTableProps = {
  data: FirmWithGroups[];
};

export function FirmsTable({ data }: FirmsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const columns = React.useMemo(() => buildColumns(), []);

  const {
    allGroups,
    selectedGroupIds,
    selectedCapabilities,
    researchStatus,
    filteredData,
    onGroupsChange,
    onCapabilitiesChange,
    onResearchStatusChange,
  } = useFirmFilters(data);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <FirmsFilterBar
        allGroups={allGroups}
        allCapabilities={ALL_CAPABILITIES}
        selectedGroupIds={selectedGroupIds}
        selectedCapabilities={selectedCapabilities}
        researchStatus={researchStatus}
        onGroupsChange={onGroupsChange}
        onCapabilitiesChange={onCapabilitiesChange}
        onResearchStatusChange={onResearchStatusChange}
      />

      <div className="rounded-md border border-neutral-200 bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-neutral-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-neutral-200">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-xs font-semibold text-neutral-500 uppercase tracking-wide py-3",
                        canSort && "cursor-pointer select-none hover:text-neutral-700"
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {canSort && (
                          <span className="text-neutral-400">
                            {sorted === "asc" ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-neutral-400 italic"
                >
                  No firms match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-neutral-100 hover:bg-neutral-50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
