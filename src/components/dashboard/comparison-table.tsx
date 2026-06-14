"use client";

import * as React from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StalenessBadge } from "@/components/research/staleness-badge";
import { FirmRefreshAction } from "@/components/dashboard/firm-refresh-action";
import { ComparisonTableFilter } from "@/components/dashboard/comparison-table-filter";
import type { CapabilityTag } from "@/lib/types";
import type { ComparisonRow } from "@/lib/queries/comparison-rows";

// ---------------------------------------------------------------------------
// Badge styling per capability tag — reused from firms-table (UI-SPEC Color)
// ---------------------------------------------------------------------------
export const TAG_STYLES: Record<CapabilityTag, string> = {
  Nuclear: "bg-amber-100 text-amber-700 border-amber-200",
  Infrastructure: "bg-sky-100 text-sky-700 border-sky-200",
  Consultancy: "bg-violet-100 text-violet-700 border-violet-200",
};

function CapabilityBadge({ tag }: { tag: string }) {
  const style =
    TAG_STYLES[tag as CapabilityTag] ??
    "bg-neutral-100 text-neutral-600 border-neutral-200";
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
// Custom filter function for capability tags (DASH-02 OR logic)
// ---------------------------------------------------------------------------
const capabilityTagFilterFn: FilterFn<ComparisonRow> = (
  row,
  columnId,
  filterValue: CapabilityTag[],
) => {
  if (!filterValue || filterValue.length === 0) return true; // no filter → show all
  const tags = row.getValue<string[]>(columnId);
  return filterValue.some((activeTag) => tags.includes(activeTag));
};
capabilityTagFilterFn.autoRemove = (val: CapabilityTag[]) =>
  !val || val.length === 0;

// ---------------------------------------------------------------------------
// Column definitions — Phase 3 extended (DASH-01/02/03/04)
// ---------------------------------------------------------------------------
const columns: ColumnDef<ComparisonRow>[] = [
  {
    accessorKey: "canonicalName",
    header: "Firm",
    cell: ({ row }) => (
      <Link
        href={`/firms/${row.original.id}`}
        className="text-blue-600 hover:underline text-sm font-medium"
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
        return <span className="text-sm text-neutral-400 italic">None</span>;
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
    filterFn: capabilityTagFilterFn,
  },
  {
    accessorKey: "lastResearchedAt",
    header: "Research Status",
    cell: ({ row }) => (
      <StalenessBadge lastResearchedAt={row.original.lastResearchedAt} />
    ),
  },
  {
    accessorKey: "contractCount",
    header: () => <span className="block text-right">Contracts</span>,
    cell: ({ row }) => (
      <span className="block text-right text-sm font-mono text-neutral-700">
        {row.getValue("contractCount")}
      </span>
    ),
  },
  {
    accessorKey: "companiesHouseNumber",
    header: () => <span className="block text-right">CH Number</span>,
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
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <FirmRefreshAction
        firmId={row.original.id}
        firmName={row.original.canonicalName}
      />
    ),
  },
];

// ---------------------------------------------------------------------------
// ComparisonTable — filterable, sortable cross-firm comparison (Phase 3)
// ---------------------------------------------------------------------------
type ComparisonTableProps = {
  rows: ComparisonRow[];
};

export function ComparisonTable({ rows }: ComparisonTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [activeTags, setActiveTags] = React.useState<CapabilityTag[]>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // Sync activeTags → columnFilters on the capabilityTags column
  React.useEffect(() => {
    setColumnFilters(
      activeTags.length > 0
        ? [{ id: "capabilityTags", value: activeTags }]
        : [],
    );
  }, [activeTags]);

  function handleToggleTag(tag: CapabilityTag) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns: {
      capabilityTagFilter: capabilityTagFilterFn,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Capability tag filter bar (DASH-02) */}
      <ComparisonTableFilter active={activeTags} onToggle={handleToggleTag} />

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
                        canSort &&
                          "cursor-pointer select-none hover:text-neutral-700"
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
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
            {table.getRowModel().rows.map((row) => (
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
