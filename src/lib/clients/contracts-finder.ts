import "server-only";

import { rateLimitedFetch } from "./http";
import type { OcdsRelease } from "@/lib/adapters/ocds";
import type { Firm } from "@/lib/types";

/**
 * Contracts Finder OCDS client (server-side only, no auth).
 *
 * Below-threshold + general UK government contracts (a floor, not a ceiling —
 * Pitfall 3). Base URL is a hard-coded constant to the fixed GOV.UK host; only the
 * firm's name/CH-number is interpolated into query params, URL-encoded (T-01-09).
 *
 * Handles OCDS page/page_size pagination explicitly (Pitfall 6) rather than
 * assuming the first page is the full result set.
 */

const CF_BASE = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
const PAGE_SIZE = 100;
const MAX_PAGES = 10; // safety cap — don't fan out unbounded

function buildSearchTerm(firm: Firm): string {
  return firm.canonicalName;
}

type CfResponse = {
  results?: Array<{ releases?: OcdsRelease[] } | OcdsRelease>;
  releases?: OcdsRelease[];
};

/** Extract OCDS releases from a Contracts Finder OCDS search page. */
function extractReleases(payload: CfResponse): OcdsRelease[] {
  const out: OcdsRelease[] = [];
  if (Array.isArray(payload.releases)) out.push(...payload.releases);
  if (Array.isArray(payload.results)) {
    for (const entry of payload.results) {
      if (entry && typeof entry === "object" && "releases" in entry && Array.isArray(entry.releases)) {
        out.push(...entry.releases);
      } else if (entry && typeof entry === "object" && "ocid" in entry) {
        out.push(entry as OcdsRelease);
      }
    }
  }
  return out;
}

/**
 * Fetch Contracts Finder OCDS releases for a firm. Returns raw OCDS releases —
 * normalisation + dedup + firm-matching happens in the OCDS adapter.
 */
export async function fetchContractsFinder(firm: Firm): Promise<OcdsRelease[]> {
  const term = buildSearchTerm(firm);
  if (!term.trim()) return [];

  const all: OcdsRelease[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url =
      `${CF_BASE}?searchTerm=${encodeURIComponent(term)}` +
      `&page=${page}&page_size=${PAGE_SIZE}`;

    const res = await rateLimitedFetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // Surface to caller via empty page-break; refreshFirm wraps errors.
      if (page === 1) {
        throw new Error(`Contracts Finder request failed (${res.status})`);
      }
      break;
    }

    let payload: CfResponse;
    try {
      payload = (await res.json()) as CfResponse;
    } catch {
      break;
    }

    const releases = extractReleases(payload);
    all.push(...releases);

    // Stop when a page returns fewer than a full page of results.
    if (releases.length < PAGE_SIZE) break;
  }

  return all;
}
