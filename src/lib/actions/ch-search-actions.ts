"use server";

import {
  searchCompanies,
  getCompanyProfile,
  type CompanySearchResult,
  type CompanyProfile,
} from "@/lib/clients/companies-house";

export type ChSearchActionResult =
  | { ok: true; results: CompanySearchResult[]; totalResults: number }
  | { ok: false; error: string };

export async function searchCompaniesAction(
  query: string,
): Promise<ChSearchActionResult> {
  const q = query.trim();
  if (!q) return { ok: true, results: [], totalResults: 0 };

  try {
    const { results, totalResults } = await searchCompanies(q);
    return { ok: true, results, totalResults };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn't reach Companies House.";
    return { ok: false, error: message };
  }
}

export type ChValidateActionResult =
  | { ok: true; profile: CompanyProfile }
  | { ok: false; notFound: boolean; error: string };

export async function validateChNumberAction(
  chNumber: string,
): Promise<ChValidateActionResult> {
  const n = chNumber.trim();
  if (!n) return { ok: false, notFound: true, error: "No number provided." };

  try {
    const profile = await getCompanyProfile(n);
    if (!profile) return { ok: false, notFound: true, error: "Not found on Companies House." };
    return { ok: true, profile };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn't reach Companies House.";
    return { ok: false, notFound: false, error: message };
  }
}

export type ChRefreshAliasesActionResult =
  | { ok: true; registeredName: string; previousNames: string[] }
  | { ok: false; error: string };

export async function refreshChAliasesAction(
  chNumber: string,
): Promise<ChRefreshAliasesActionResult> {
  const n = chNumber.trim();
  if (!n) return { ok: false, error: "No CH number provided." };

  try {
    const profile = await getCompanyProfile(n);
    if (!profile) return { ok: false, error: "Not found on Companies House." };
    const previousNames = (profile.previous_company_names ?? []).map((p) => p.name);
    return { ok: true, registeredName: profile.company_name, previousNames };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn't reach Companies House.";
    return { ok: false, error: message };
  }
}
