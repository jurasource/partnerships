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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Firm, PartnershipPair } from "@/lib/types";

type PartnershipRow = PartnershipPair & {
  firmAName: string;
  firmBName: string;
};

type Props = {
  allFirms: Firm[];
  partnershipPairs: PartnershipPair[];
};

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDateGB(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function PartnershipTable({ allFirms, partnershipPairs }: Props) {
  const firmNameMap = new Map(allFirms.map((f) => [f.id, f]));

  const rows: PartnershipRow[] = partnershipPairs.map((p) => ({
    ...p,
    firmAName: firmNameMap.get(p.firmAId)?.canonicalName ?? p.firmAId,
    firmBName: firmNameMap.get(p.firmBId)?.canonicalName ?? p.firmBId,
  }));

  const columns: ColumnDef<PartnershipRow>[] = [
    {
      accessorKey: "firmAName",
      header: "Firm A",
      cell: ({ row }) => (
        <Link
          href={`/firms/${row.original.firmAId}`}
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          {row.getValue("firmAName")}
        </Link>
      ),
    },
    {
      accessorKey: "firmBName",
      header: "Firm B",
      cell: ({ row }) => (
        <Link
          href={`/firms/${row.original.firmBId}`}
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          {row.getValue("firmBName")}
        </Link>
      ),
    },
    {
      accessorKey: "partnershipType",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue<string>("partnershipType");
        return (
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0.5 border bg-green-50 text-green-700 border-green-100"
          >
            {type === "jv" ? "JV" : "Co-supplier"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "evidenceSummary",
      header: "Evidence",
      enableSorting: false,
      cell: ({ row }) => {
        const text = row.getValue<string>("evidenceSummary");
        const truncated = truncate(text, 60);
        if (truncated === text) {
          return <span className="text-sm text-neutral-700">{text}</span>;
        }
        return (
          <Tooltip>
            <TooltipTrigger render={<span className="cursor-default" />}>
              <span className="text-sm text-neutral-700">{truncated}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{text}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "sourceType",
      header: "Source",
      enableSorting: false,
      cell: ({ row }) => {
        const src = row.getValue<string>("sourceType");
        const isOcds = src === "ocds";
        return (
          <Badge
            variant="outline"
            className={cn(
              "text-xs px-1.5 py-0.5 border",
              isOcds
                ? "bg-sky-50 text-sky-700 border-sky-100"
                : "bg-violet-50 text-violet-700 border-violet-100",
            )}
          >
            {isOcds ? "OCDS" : "AI Research"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "evidenceDate",
      header: "Date",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-neutral-600">
          {formatDateGB(row.getValue<string | null>("evidenceDate"))}
        </span>
      ),
    },
  ];

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "partnershipType", desc: false },
    { id: "evidenceDate", desc: true },
  ]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No partnership evidence found across researched firms.
      </p>
    );
  }

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
                      canSort && "cursor-pointer select-none hover:text-neutral-700",
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
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
  );
}
