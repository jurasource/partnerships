import "server-only";
import { z } from "zod";

import { rateLimitedFetch } from "./http";

/**
 * Companies House Public Data API client (server-side only).
 *
 * Auth: HTTP Basic — the free API key is the username, password blank (T-01-08).
 * The key is read from process.env here and NEVER referenced in a client component.
 * Base URL is a hard-coded constant to a fixed GOV.UK host; only the CH *number*
 * and search *query* are user-supplied and are URL-encoded into fixed paths
 * (no user-controlled host/scheme reaches fetch — SSRF mitigation T-01-09).
 *
 * Responses are Zod-validated into typed shapes (T-01-10).
 */

const CH_BASE = "https://api.company-information.service.gov.uk";

function authHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) {
    throw new Error(
      "COMPANIES_HOUSE_API_KEY is not set — Companies House lookups require a free API key.",
    );
  }
  // HTTP Basic: key as username, blank password.
  const token = Buffer.from(`${key}:`).toString("base64");
  return `Basic ${token}`;
}

async function chGet(path: string): Promise<unknown> {
  const res = await rateLimitedFetch(`${CH_BASE}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Companies House request failed (${res.status}) for ${path}`);
  }
  return res.json();
}

// --- schemas (defensive — only fields we use, .passthrough tolerant) -----
const RegisteredOfficeAddress = z
  .object({
    locality: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
  })
  .passthrough();

const CompanyProfileSchema = z
  .object({
    company_number: z.string(),
    company_name: z.string(),
    company_status: z.string().optional(),
    type: z.string().optional(),
    date_of_creation: z.string().optional(),
    jurisdiction: z.string().optional(),
    registered_office_address: RegisteredOfficeAddress.optional(),
  })
  .passthrough();

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

const PscItemSchema = z
  .object({
    name: z.string().optional(),
    kind: z.string().optional(),
    nationality: z.string().optional(),
    country_of_residence: z.string().optional(),
    natures_of_control: z.array(z.string()).optional(),
  })
  .passthrough();

const PscRecordSchema = z
  .object({
    active_count: z.number().optional(),
    ceased_count: z.number().optional(),
    items: z.array(PscItemSchema).optional().default([]),
  })
  .passthrough();

export type PscRecord = z.infer<typeof PscRecordSchema>;

const OfficersSchema = z
  .object({
    active_count: z.number().optional(),
    items: z
      .array(
        z
          .object({
            name: z.string().optional(),
            officer_role: z.string().optional(),
            nationality: z.string().optional(),
            appointed_on: z.string().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();

export type OfficersRecord = z.infer<typeof OfficersSchema>;

const SearchResultSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            company_number: z.string(),
            title: z.string(),
            company_status: z.string().optional(),
            address_snippet: z.string().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();

export type CompanySearchResult = {
  companyNumber: string;
  title: string;
  status?: string;
  address?: string;
};

/** Encode a CH number into the fixed path — never let it alter host/scheme. */
function encodeNumber(number: string): string {
  return encodeURIComponent(number.trim());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCompanyProfile(number: string): Promise<CompanyProfile | null> {
  const data = await chGet(`/company/${encodeNumber(number)}`);
  if (data === null) return null;
  return CompanyProfileSchema.parse(data);
}

export async function getPSC(number: string): Promise<PscRecord | null> {
  const data = await chGet(
    `/company/${encodeNumber(number)}/persons-with-significant-control`,
  );
  if (data === null) return null;
  return PscRecordSchema.parse(data);
}

export async function getOfficers(number: string): Promise<OfficersRecord | null> {
  const data = await chGet(`/company/${encodeNumber(number)}/officers`);
  if (data === null) return null;
  return OfficersSchema.parse(data);
}

export async function searchCompanies(q: string): Promise<CompanySearchResult[]> {
  const query = q.trim();
  if (!query) return [];
  const data = await chGet(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=10`);
  if (data === null) return [];
  const parsed = SearchResultSchema.parse(data);
  return parsed.items.map((item) => ({
    companyNumber: item.company_number,
    title: item.title,
    status: item.company_status,
    address: item.address_snippet,
  }));
}
