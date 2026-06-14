
import { rateLimitedFetch } from "./http";
import type { OcdsRelease } from "@/lib/adapters/ocds";
import type { Firm } from "@/lib/types";

/**
 * Find a Tender Service (FTS) OCDS 1.1.5 client (server-side only, no auth).
 *
 * Higher-value / above-threshold UK procurement notices (formerly OJEU). Above-
 * threshold notices appear on BOTH FTS and Contracts Finder, so dedup-by-ocid in
 * the OCDS adapter is essential (Pitfall 3, D-09). Base URL is a hard-coded
 * constant to the fixed GOV.UK host (T-01-09).
 *
 * FTS paginates OCDS release packages via a `links.next` cursor — we follow it
 * explicitly up to a safety cap (Pitfall 6).
 */

const FTS_BASE = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";
const MAX_PAGES = 10;

type FtsPackage = {
  releases?: OcdsRelease[];
  links?: { next?: string };
};

/**
 * Fetch Find a Tender OCDS releases for a firm. Returns raw OCDS releases —
 * normalisation + dedup + firm-matching happens in the OCDS adapter.
 */
export async function fetchFindATender(firm: Firm): Promise<OcdsRelease[]> {
  const term = firm.canonicalName;
  if (!term.trim()) return [];

  const all: OcdsRelease[] = [];

  // FTS does not offer a free-text supplier search on the OCDS package endpoint;
  // we page recent release packages and let the OCDS adapter match by CH number.
  let nextUrl: string | null = `${FTS_BASE}?limit=100`;
  let pages = 0;

  while (nextUrl && pages < MAX_PAGES) {
    // Only follow FTS-origin next links — never an arbitrary host (SSRF, T-01-09).
    if (!nextUrl.startsWith("https://www.find-tender.service.gov.uk/")) break;

    const res = await rateLimitedFetch(nextUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      if (pages === 0) {
        throw new Error(`Find a Tender request failed (${res.status})`);
      }
      break;
    }

    let pkg: FtsPackage;
    try {
      pkg = (await res.json()) as FtsPackage;
    } catch {
      break;
    }

    if (Array.isArray(pkg.releases)) all.push(...pkg.releases);

    nextUrl = pkg.links?.next ?? null;
    pages += 1;
  }

  return all;
}
