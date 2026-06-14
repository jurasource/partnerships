"use server";

import { searchCompanies, type CompanySearchResult } from "@/lib/clients/companies-house";

/**
 * Server action wrapper around the Companies House search client (D-03).
 *
 * The CH API key lives only in the server-side client (T-01-08) — this action is
 * the boundary the Add/Edit Firm dialog calls, so the key is never imported into
 * a client component. Only the user-supplied query string crosses the boundary;
 * it is URL-encoded into a fixed CH search path inside the client (T-01-09).
 */
export type ChSearchActionResult =
  | { ok: true; results: CompanySearchResult[] }
  | { ok: false; error: string };

export async function searchCompaniesAction(
  query: string,
): Promise<ChSearchActionResult> {
  const q = query.trim();
  if (!q) return { ok: true, results: [] };

  try {
    const results = await searchCompanies(q);
    return { ok: true, results };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn't reach Companies House.";
    return { ok: false, error: message };
  }
}
