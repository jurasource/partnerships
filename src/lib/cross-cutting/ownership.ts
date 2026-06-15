/**
 * Ownership extraction for cross-cutting analysis (PROF-04/ANAL-03).
 *
 * Reads Companies House PSC data (primary source, D-07) and corroborates with
 * the "Ownership structure" topic finding (secondary source). Persists exactly
 * one ownership_records row per firm via onConflictDoUpdate upsert.
 *
 * NEVER throws on missing data — writes an explicit "unknown" record
 * instead (explicit empty-state pattern from Phase 2).
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { firms, ownershipRecords } from "@/db/schema";
import { getCompanyProfile, getPSC } from "@/lib/clients/companies-house";
import { findFindingByTopicName, TOPIC_NAMES } from "./topic-lookup";

// ---------------------------------------------------------------------------
// PSC classification logic (reused from grounding.ts, adapted for structured output)
// ---------------------------------------------------------------------------

const UK_NATURAL_PERSON_TERMS = [
  "british",
  "english",
  "scottish",
  "welsh",
  "northern irish",
  "united kingdom",
];

const UK_COUNTRY_TERMS = [
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "united kingdom",
  "england and wales",
];

/**
 * Check whether a PSC item represents a UK natural person.
 */
function isUkNaturalPerson(item: {
  kind?: string;
  nationality?: string;
}): boolean {
  // Corporate entities handled separately — never classify as natural person
  if (item.kind?.toLowerCase().includes("corporate-entity")) return false;
  if (!item.nationality) return false;
  const nat = item.nationality.toLowerCase();
  return UK_NATURAL_PERSON_TERMS.some((term) => nat.includes(term));
}

/**
 * Check whether a corporate PSC is UK-registered.
 *
 * Corporate PSCs carry their jurisdiction in identification.country_of_registration,
 * NOT in country_of_residence (that field is for natural persons only).
 */
function isUkCorporatePsc(item: {
  kind?: string;
  country_of_residence?: string;
  identification?: { country_of_registration?: string };
}): boolean {
  if (!item.kind?.toLowerCase().includes("corporate-entity")) return false;
  // Prefer identification.country_of_registration; fall back to country_of_residence
  const raw = item.identification?.country_of_registration ?? item.country_of_residence ?? "";
  const country = raw.toLowerCase();
  if (!country) return false;
  return UK_COUNTRY_TERMS.some((term) => country.includes(term));
}

/**
 * Derive a country code from a corporate PSC's jurisdiction.
 * Returns "UK" for UK entities, the country name for foreign ones (ISO mapping is
 * best-effort from the CH free text — the calling code handles nulls gracefully).
 */
function deriveForeignCountry(item: {
  country_of_residence?: string;
  identification?: { country_of_registration?: string };
}): string | null {
  const raw = item.identification?.country_of_registration ?? item.country_of_residence;
  if (!raw) return null;
  // Common ISO mappings from CH free text
  const ISO_MAP: Record<string, string> = {
    france: "FR",
    germany: "DE",
    "united states": "US",
    usa: "US",
    "united states of america": "US",
    netherlands: "NL",
    japan: "JP",
    china: "CN",
    spain: "ES",
    italy: "IT",
    sweden: "SE",
    canada: "CA",
    australia: "AU",
    russia: "RU",
    "south korea": "KR",
    india: "IN",
    switzerland: "CH",
    belgium: "BE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    luxembourg: "LU",
    ireland: "IE",
    "czech republic": "CZ",
    austria: "AT",
    portugal: "PT",
    poland: "PL",
  };
  const lower = raw.toLowerCase();
  return ISO_MAP[lower] ?? raw.toUpperCase().slice(0, 2);
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract and persist the ownership record for a firm.
 *
 * Data priority:
 * 1. Companies House PSC data (structured, current, authoritative)
 * 2. "Ownership structure" topic finding (AI-derived, corroborating)
 * 3. Explicit "unknown" record if both are absent
 *
 * Always upserts exactly one row per firm.
 *
 * @param firmId  ID of the firm to extract ownership for
 */
export async function extractOwnership(firmId: string): Promise<void> {
  // Load firm
  const [firm] = await db
    .select()
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (!firm) {
    throw new Error(`extractOwnership: firm not found: ${firmId}`);
  }

  const chNumber = firm.companiesHouseNumber;

  // Attempt CH data fetch if a company number is available
  let profile = null;
  let psc = null;

  if (chNumber) {
    try {
      [profile, psc] = await Promise.all([
        getCompanyProfile(chNumber).catch(() => null),
        getPSC(chNumber).catch(() => null),
      ]);
    } catch {
      // CH API failure — fall through to AI research fallback
    }
  }

  // Attempt to load the "Ownership structure" finding for corroboration / fallback
  const ownershipFinding = await findFindingByTopicName(firmId, TOPIC_NAMES.ownership);

  // ---------------------------------------------------------------------------
  // Determine ownership attributes from CH PSC data
  // ---------------------------------------------------------------------------

  if (chNumber && psc?.items && psc.items.length > 0) {
    const items = psc.items;

    const allUk = items.every(
      (item) => isUkNaturalPerson(item) || isUkCorporatePsc(item),
    );

    // Find foreign corporate PSCs — these trigger pscNotTraceable
    const foreignCorporatePscs = items.filter(
      (item) =>
        item.kind?.toLowerCase().includes("corporate-entity") &&
        !isUkCorporatePsc(item),
    );

    const hasForeignCorporatePsc = foreignCorporatePscs.length > 0;
    const ukIncorporated: "yes" | "no" | "unknown" = allUk ? "yes" : "no";
    const pscNotTraceable: "yes" | "no" = hasForeignCorporatePsc ? "yes" : "no";

    // Derive country of ownership — foreign corporate PSC's country takes precedence
    let countryOfOwnership: string | null = null;
    if (allUk) {
      countryOfOwnership = "UK";
    } else if (hasForeignCorporatePsc) {
      countryOfOwnership = deriveForeignCountry(foreignCorporatePscs[0]);
    }

    // Ultimate parent name from foreign corporate PSC
    const ultimateParent = hasForeignCorporatePsc
      ? (foreignCorporatePscs[0].name ?? null)
      : null;

    // CH URL for the firm's Companies House page
    const sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${chNumber}`;

    await db
      .insert(ownershipRecords)
      .values({
        firmId,
        ukIncorporated,
        ultimateParent,
        countryOfOwnership,
        pscNotTraceable,
        sourceType: "companies_house",
        sourceUrl,
        sourceTitle: "Companies House — Persons with Significant Control",
        rawSnippet:
          `CH PSC register: ${items.length} person(s) with significant control; ` +
          `${hasForeignCorporatePsc ? `${foreignCorporatePscs.length} non-UK corporate PSC(s): ${foreignCorporatePscs.map((p) => p.name ?? "unnamed").join(", ")}` : "all UK or UK-corporate PSC(s)"}`,
      })
      .onConflictDoUpdate({
        target: [ownershipRecords.firmId],
        set: {
          ukIncorporated,
          ultimateParent,
          countryOfOwnership,
          pscNotTraceable,
          sourceType: "companies_house",
          sourceUrl,
          sourceTitle: "Companies House — Persons with Significant Control",
          rawSnippet:
            `CH PSC register: ${items.length} person(s) with significant control; ` +
            `${hasForeignCorporatePsc ? `${foreignCorporatePscs.length} non-UK corporate PSC(s): ${foreignCorporatePscs.map((p) => p.name ?? "unnamed").join(", ")}` : "all UK or UK-corporate PSC(s)"}`,
        },
      });

    return;
  }

  // ---------------------------------------------------------------------------
  // Fallback: no CH PSC data — use AI finding or write "unknown" record
  // ---------------------------------------------------------------------------

  if (ownershipFinding && ownershipFinding.sourceUrl !== "not-found") {
    // We have an AI-derived ownership finding — use it
    await db
      .insert(ownershipRecords)
      .values({
        firmId,
        ukIncorporated: "unknown",
        ultimateParent: null,
        countryOfOwnership: null,
        pscNotTraceable: "no",
        sourceType: "ai_research",
        sourceUrl: ownershipFinding.sourceUrl,
        sourceTitle: ownershipFinding.sourceTitle,
        rawSnippet: ownershipFinding.rawSnippet,
      })
      .onConflictDoUpdate({
        target: [ownershipRecords.firmId],
        set: {
          ukIncorporated: "unknown",
          ultimateParent: null,
          countryOfOwnership: null,
          pscNotTraceable: "no",
          sourceType: "ai_research",
          sourceUrl: ownershipFinding.sourceUrl,
          sourceTitle: ownershipFinding.sourceTitle,
          rawSnippet: ownershipFinding.rawSnippet,
        },
      });

    return;
  }

  // ---------------------------------------------------------------------------
  // Last resort: write explicit "unknown" record with an informative snippet
  // ---------------------------------------------------------------------------
  const noDataSnippet = chNumber
    ? `Companies House number ${chNumber} found but PSC data unavailable; no ownership finding cached.`
    : `No Companies House number and no ownership finding available for this firm.`;

  await db
    .insert(ownershipRecords)
    .values({
      firmId,
      ukIncorporated: "unknown",
      ultimateParent: null,
      countryOfOwnership: null,
      pscNotTraceable: "no",
      sourceType: "ai_research",
      sourceUrl: "not-found",
      sourceTitle: "Ownership extraction — no data",
      rawSnippet: noDataSnippet,
    })
    .onConflictDoUpdate({
      target: [ownershipRecords.firmId],
      set: {
        ukIncorporated: "unknown",
        ultimateParent: null,
        countryOfOwnership: null,
        pscNotTraceable: "no",
        sourceType: "ai_research",
        sourceUrl: "not-found",
        sourceTitle: "Ownership extraction — no data",
        rawSnippet: noDataSnippet,
      },
    });
}
