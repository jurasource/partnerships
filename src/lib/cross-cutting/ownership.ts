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
import { firms, ownershipRecords, chSnapshots } from "@/db/schema";
import { getCompanyProfile, getPSC, getOfficers, type CompanyProfile, type PscRecord, type OfficersRecord } from "@/lib/clients/companies-house";
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
 * UK jurisdiction tokens returned by the Companies House company profile
 * `jurisdiction` field (e.g. "england-wales", "scotland", "northern-ireland").
 * A firm registered under any of these IS UK-incorporated, regardless of
 * whether its PSC register is populated (LLPs frequently have an empty PSC
 * register but are unambiguously UK-incorporated).
 */
const UK_JURISDICTION_TERMS = [
  "england",
  "wales",
  "scotland",
  "northern-ireland",
  "northern ireland",
  "united-kingdom",
  "united kingdom",
  "uk",
];

/**
 * Determine whether a Companies House profile.jurisdiction value is UK.
 * Returns true for UK jurisdictions, false for known non-UK, and null when
 * the jurisdiction is absent/unrecognised (caller decides the fallback).
 */
function isUkJurisdiction(jurisdiction?: string): boolean | null {
  if (!jurisdiction) return null;
  const j = jurisdiction.toLowerCase().trim();
  if (UK_JURISDICTION_TERMS.some((term) => j.includes(term))) return true;
  return false;
}

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
// CH fetch + snapshot helper
// ---------------------------------------------------------------------------

/**
 * Fetch the three Companies House endpoints for a given CH number and upsert
 * the raw responses into ch_snapshots.
 *
 * Individual API call failures are caught and return null — a partial fetch
 * (e.g. profile OK but PSC 404) is still cached. DB errors are NOT caught
 * here and will propagate to the caller so the job fails visibly rather than
 * silently writing nothing.
 */
async function fetchAndCacheCH(
  firmId: string,
  chNumber: string,
): Promise<{ profile: CompanyProfile | null; psc: PscRecord | null; officers: OfficersRecord | null }> {
  const [profile, psc, officers] = await Promise.all([
    getCompanyProfile(chNumber).catch(() => null),
    getPSC(chNumber).catch(() => null),
    getOfficers(chNumber).catch(() => null),
  ]);

  if (profile !== null || psc !== null || officers !== null) {
    const now = new Date().toISOString();
    await db
      .insert(chSnapshots)
      .values({
        firmId,
        profileJson: profile ? JSON.stringify(profile) : null,
        pscJson: psc ? JSON.stringify(psc) : null,
        officersJson: officers ? JSON.stringify(officers) : null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [chSnapshots.firmId],
        set: {
          profileJson: profile ? JSON.stringify(profile) : null,
          pscJson: psc ? JSON.stringify(psc) : null,
          officersJson: officers ? JSON.stringify(officers) : null,
          fetchedAt: now,
        },
      });
  }

  return { profile, psc, officers };
}

/**
 * Fetch and cache Companies House data for a firm without running the full
 * ownership extraction. Safe to call standalone (e.g. from a "Refresh CH"
 * server action on the firm profile page). No-ops if the firm has no CH number.
 */
export async function refreshCHSnapshot(firmId: string): Promise<void> {
  const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
  if (!firm) throw new Error(`refreshCHSnapshot: firm not found: ${firmId}`);
  if (!firm.companiesHouseNumber) return;
  await fetchAndCacheCH(firmId, firm.companiesHouseNumber);
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
  let officers = null;

  if (chNumber) {
    ({ profile, psc, officers } = await fetchAndCacheCH(firmId, chNumber));
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

    // Incorporation is determined by the company's own registration jurisdiction
    // (authoritative), NOT by who controls it. A UK-registered firm with a
    // foreign corporate PSC is still UK-incorporated. Fall back to PSC-derived
    // nationality only when the profile jurisdiction is absent/unrecognised.
    const jurisdictionIsUk = isUkJurisdiction(profile?.jurisdiction);
    const ukIncorporated: "yes" | "no" | "unknown" =
      jurisdictionIsUk === true
        ? "yes"
        : jurisdictionIsUk === false
          ? "no"
          : allUk
            ? "yes"
            : "no";
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
  // CH profile available but PSC register empty (common for LLPs).
  // The PSC register being empty does NOT mean incorporation is unknown — the
  // company profile's jurisdiction is the authoritative incorporation signal.
  // Use it directly so UK-registered firms with no PSC entries (e.g. Baringa
  // Partners LLP, OC303471) are correctly marked UK-incorporated.
  // ---------------------------------------------------------------------------

  if (chNumber && profile) {
    const jurisdictionIsUk = isUkJurisdiction(profile.jurisdiction);

    if (jurisdictionIsUk !== null) {
      const ukIncorporated: "yes" | "no" = jurisdictionIsUk ? "yes" : "no";
      const countryOfOwnership = jurisdictionIsUk ? "UK" : null;
      const sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${chNumber}`;
      const rawSnippet =
        `Companies House profile: jurisdiction "${profile.jurisdiction}"` +
        `${profile.type ? ` (type: ${profile.type})` : ""}; ` +
        `PSC register empty (no persons with significant control listed).`;

      await db
        .insert(ownershipRecords)
        .values({
          firmId,
          ukIncorporated,
          ultimateParent: null,
          countryOfOwnership,
          pscNotTraceable: "no",
          sourceType: "companies_house",
          sourceUrl,
          sourceTitle: "Companies House — Company Profile",
          rawSnippet,
        })
        .onConflictDoUpdate({
          target: [ownershipRecords.firmId],
          set: {
            ukIncorporated,
            ultimateParent: null,
            countryOfOwnership,
            pscNotTraceable: "no",
            sourceType: "companies_house",
            sourceUrl,
            sourceTitle: "Companies House — Company Profile",
            rawSnippet,
          },
        });

      return;
    }
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
