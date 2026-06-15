"use client";

import * as React from "react";
import { Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  searchCompaniesAction,
  validateChNumberAction,
  type ChSearchActionResult,
} from "@/lib/actions/ch-search-actions";
import type { CompanyProfile, CompanySearchResult } from "@/lib/clients/companies-house";

type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "valid"; profile: CompanyProfile }
  | { status: "invalid"; error: string };

type ChSearchStepProps = {
  /** Pre-populate and auto-validate a CH number (edit mode). */
  defaultChNumber?: string;
  /** Called whenever a valid company profile is selected or deselected. */
  onSelect: (profile: CompanyProfile | null) => void;
};

/**
 * Step 1 of the Add/Edit Firm wizard.
 *
 * Two entry paths:
 *   A) Name search → explicit Search button → results list → auto-select first →
 *      preview panel → Next enabled.
 *   B) Direct CH number entry (8 chars) → debounce validate → ✓/✗ badge →
 *      preview panel on success → Next enabled.
 *
 * CH API key stays server-side via server actions (T-01-08).
 */
export function ChSearchStep({ defaultChNumber, onSelect }: ChSearchStepProps) {
  const [query, setQuery] = React.useState(defaultChNumber ?? "");
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<CompanySearchResult[]>([]);
  const [totalResults, setTotalResults] = React.useState(0);
  const [selectedResult, setSelectedResult] = React.useState<CompanySearchResult | null>(null);
  const [validation, setValidation] = React.useState<ValidationState>({ status: "idle" });
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "dissolved">("active");

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-validate if we have a defaultChNumber on mount (edit mode)
  React.useEffect(() => {
    if (defaultChNumber?.trim()) {
      runValidate(defaultChNumber.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runValidate(number: string) {
    setValidation({ status: "validating" });
    const res = await validateChNumberAction(number);
    if (res.ok) {
      setValidation({ status: "valid", profile: res.profile });
      onSelect(res.profile);
    } else {
      setValidation({ status: "invalid", error: res.error });
      onSelect(null);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    // Clear previous results when user types
    setResults([]);
    setSelectedResult(null);
    setSearchError(null);
    setValidation({ status: "idle" });
    onSelect(null);

    // Debounce-validate if input looks like a raw CH number (8 alphanumeric chars)
    const stripped = value.trim().replace(/\s/g, "");
    if (/^[A-Z0-9]{8}$/i.test(stripped)) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        runValidate(stripped);
      }, 600);
    }
  }

  async function handleSearch() {
    const q = query.trim();
    if (!q || searching) return;

    setSearching(true);
    setSearchError(null);
    setResults([]);
    setSelectedResult(null);
    setValidation({ status: "idle" });
    onSelect(null);

    const res: ChSearchActionResult = await searchCompaniesAction(q);
    setSearching(false);

    if (!res.ok) {
      setSearchError("Couldn't reach Companies House. Try again or enter the CH number directly.");
      return;
    }
    if (res.results.length === 0) {
      setSearchError("No companies matched that search.");
      return;
    }

    setResults(res.results);
    setTotalResults(res.totalResults);
    // Auto-select first active result, falling back to first result
    const firstActive =
      res.results.find((r) => r.status?.toLowerCase() === "active") ?? res.results[0];
    await selectResult(firstActive);
  }

  function handleStatusFilter(next: "all" | "active" | "dissolved") {
    setStatusFilter(next);
    // If the currently selected result will be hidden by the new filter, deselect
    if (next !== "all" && selectedResult) {
      const stillVisible = selectedResult.status?.toLowerCase() === next;
      if (!stillVisible) {
        setSelectedResult(null);
        setValidation({ status: "idle" });
        onSelect(null);
      }
    }
  }

  async function selectResult(result: CompanySearchResult) {
    setSelectedResult(result);
    await runValidate(result.companyNumber);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  const isValid = validation.status === "valid";
  const profile = isValid ? validation.profile : null;

  const filteredResults =
    statusFilter === "all"
      ? results
      : results.filter((r) => r.status?.toLowerCase() === statusFilter);

  return (
    <div className="space-y-3">
      {/* Search input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Company name or CH number (e.g. 12345678)"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pr-8"
          />
          {/* ✓/✗ badge for direct CH number entry */}
          {validation.status === "validating" && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
          )}
          {validation.status === "valid" && results.length === 0 && (
            <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
          {validation.status === "invalid" && results.length === 0 && (
            <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="shrink-0"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Search className="h-4 w-4 mr-1.5" />
          )}
          Search
        </Button>
      </div>

      {/* Search error */}
      {searchError && (
        <p className="text-xs text-amber-600">{searchError}</p>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="space-y-1.5">
          {/* Status filter toggle */}
          <div className="flex items-center gap-1">
            {(["all", "active", "dissolved"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleStatusFilter(f)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs capitalize transition-colors",
                  statusFilter === f
                    ? "bg-neutral-200 text-neutral-800 font-medium"
                    : "text-neutral-500 hover:text-neutral-700",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {filteredResults.length > 0 ? (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-neutral-200 bg-white text-sm">
              {filteredResults.map((r) => (
                <li key={r.companyNumber}>
                  <button
                    type="button"
                    onClick={() => selectResult(r)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-neutral-50 transition-colors",
                      selectedResult?.companyNumber === r.companyNumber &&
                        "bg-blue-50 border-l-2 border-blue-500",
                    )}
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
          ) : (
            <p className="text-xs text-neutral-400 py-1">
              No {statusFilter} companies in these results — try "All" to see everything.
            </p>
          )}

          <p className="text-xs text-neutral-400">
            {totalResults > results.length
              ? `Showing ${results.length} of ${totalResults} results — type more to narrow`
              : `${results.length} result${results.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      )}

      {/* Preview panel */}
      {validation.status === "validating" && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading company details…
        </div>
      )}

      {validation.status === "invalid" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {validation.error}
        </div>
      )}

      {profile && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-neutral-900">{profile.company_name}</p>
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <dt className="text-neutral-500">CH Number</dt>
              <dd className="font-mono text-neutral-800">{profile.company_number}</dd>
            </div>
            {profile.type && (
              <div>
                <dt className="text-neutral-500">Type</dt>
                <dd className="text-neutral-800 capitalize">{profile.type.replace(/_/g, " ")}</dd>
              </div>
            )}
            {profile.company_status && (
              <div>
                <dt className="text-neutral-500">Status</dt>
                <dd className="text-neutral-800 capitalize">{profile.company_status}</dd>
              </div>
            )}
            {profile.date_of_creation && (
              <div>
                <dt className="text-neutral-500">Incorporated</dt>
                <dd className="text-neutral-800">{profile.date_of_creation}</dd>
              </div>
            )}
            {profile.registered_office_address && (
              <div className="col-span-2">
                <dt className="text-neutral-500">Address</dt>
                <dd className="text-neutral-800">
                  {[
                    profile.registered_office_address.address_line_1,
                    profile.registered_office_address.locality,
                    profile.registered_office_address.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
