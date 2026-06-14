"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ContractRow = {
  title: string | null;
  awardDate: string | null;
  noticeDate: string | null;
  value: string | null;
  sourceApi: string;
  ocid: string;
};

/**
 * Format an ISO date string (or partial date) as "14 Jun 2026" (en-GB).
 * Mirrors the formatAbsoluteDate pattern from staleness-badge.tsx.
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Format a numeric string as compact GBP (e.g. "£1.2M").
 * Returns "—" when value is null or unparseable.
 */
function formatGBP(valueStr: string | null): string {
  if (!valueStr) return "—";
  const num = parseFloat(valueStr);
  if (isNaN(num)) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return "—";
  }
}

/**
 * Truncate a title to 60 characters for display (full title in Tooltip).
 */
function TruncatedTitle({ title }: { title: string | null }) {
  if (!title) return <span className="text-neutral-400 italic">—</span>;

  if (title.length <= 60) {
    return <span className="text-sm">{title}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="text-sm cursor-default truncate block max-w-full" />
        }
      >
        {title.slice(0, 59) + "…"}
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{title}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Source badge: "CF" for Contracts Finder, "FTS" for Find a Tender.
 */
function SourceBadge({ sourceApi }: { sourceApi: string }) {
  const isCF = sourceApi === "contracts_finder";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal px-1.5 py-0.5 border",
        isCF
          ? "bg-sky-50 text-sky-700 border-sky-100"
          : "bg-violet-50 text-violet-700 border-violet-100",
      )}
    >
      {isCF ? "CF" : "FTS"}
    </Badge>
  );
}

const columns: ColumnDef<ContractRow>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => <TruncatedTitle title={row.getValue("title")} />,
  },
  {
    accessorKey: "awardDate",
    header: () => <span>Date</span>,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-neutral-700">
        {formatDate(row.getValue("awardDate"))}
      </span>
    ),
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "value",
    header: () => <span className="block text-right">Value</span>,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-neutral-700 block text-right">
        {formatGBP(row.getValue("value"))}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "sourceApi",
    header: "Source",
    cell: ({ row }) => (
      <SourceBadge sourceApi={row.getValue("sourceApi")} />
    ),
    enableSorting: false,
  },
];

type ContractHistoryTableProps = {
  contracts: ContractRow[];
};

/**
 * ContractHistoryTable — TanStack Table of matched OCDS procurement records.
 *
 * Columns: Title (flex-1, 60-char truncation + Tooltip), Date (en-GB format,
 * font-mono text-xs), Value (GBP compact, right-aligned, font-mono text-xs),
 * Source (CF/FTS badge).
 *
 * Default sort: awardDate descending (most recent first).
 * Empty state: single row spanning all columns with PROF-03 copy.
 */
export function ContractHistoryTable({ contracts }: ContractHistoryTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "awardDate", desc: true },
  ]);

  const table = useReactTable({
    data: contracts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
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
                        "cursor-pointer select-none hover:text-neutral-700",
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
                        header.getContext(),
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
            /* Empty state — PROF-03 copy */
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-6 text-center text-sm text-neutral-400 italic"
              >
                No matched procurement records found via Companies House number.
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
  );
}
