"use client";

import * as React from "react";
import { Search, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  searchCompaniesAction,
  type ChSearchActionResult,
} from "@/lib/actions/ch-search-actions";

/**
 * Search CH field (D-03). Replaces the stubbed Search CH button in the firm dialog.
 *
 * On "Search CH" click it calls the searchCompaniesAction server action (so the CH
 * API key stays server-side, T-01-08) using the current CH-number/name input as the
 * query, renders the results in a picker, and on selection auto-fills the CH number.
 * Manual entry remains primary and the field stays editable (D-02).
 */
export function ChSearchField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (chNumber: string) => void;
  error?: boolean;
}) {
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<
    { companyNumber: string; title: string; status?: string; address?: string }[]
  >([]);
  const [open, setOpen] = React.useState(false);

  async function handleSearch() {
    const query = value.trim();
    if (!query || searching) return;

    setSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      const res: ChSearchActionResult = await searchCompaniesAction(query);
      if (res.ok) {
        setResults(res.results);
        setOpen(true);
        if (res.results.length === 0) {
          setSearchError("No companies matched that search.");
        }
      } else {
        setSearchError(
          "Couldn't reach Companies House. Enter the number manually or try again.",
        );
      }
    } catch {
      setSearchError(
        "Couldn't reach Companies House. Enter the number manually or try again.",
      );
    } finally {
      setSearching(false);
    }
  }

  function pick(companyNumber: string) {
    onChange(companyNumber);
    setOpen(false);
    setResults([]);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id="ch-number"
          placeholder="e.g. 03846738"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "font-mono",
            error && "border-red-500 focus-visible:ring-red-500",
          )}
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSearch}
                disabled={searching || !value.trim()}
                aria-label="Search Companies House"
                className="shrink-0"
              />
            }
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </TooltipTrigger>
          <TooltipContent>Search Companies House by name or number</TooltipContent>
        </Tooltip>
      </div>

      {searchError && <p className="text-xs text-amber-600">{searchError}</p>}

      {open && results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-neutral-200 bg-white text-sm">
          {results.map((r) => (
            <li key={r.companyNumber}>
              <button
                type="button"
                onClick={() => pick(r.companyNumber)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-neutral-50"
              >
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-neutral-500">
                  <span className="font-mono">{r.companyNumber}</span>
                  {r.status ? ` · ${r.status}` : ""}
                  {r.address ? ` · ${r.address}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
