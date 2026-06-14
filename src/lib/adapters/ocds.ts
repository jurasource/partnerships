import { db } from "@/db/client";
import { procurementRecords } from "@/db/schema";
import type { Firm } from "@/lib/types";

/**
 * OCDS normalisation + deduplication adapter (D-09, D-10, DATA-04, DATA-05).
 *
 * Both Contracts Finder and Find a Tender speak OCDS — we model the release shape
 * once and reuse it across both. Untrusted third-party JSON is read defensively
 * (T-01-10): we only pull known fields into typed columns, never spread arbitrary
 * keys, and we tolerate empty/implausible fields without throwing (Pitfall 3).
 */

export type SourceApi = "contracts_finder" | "find_a_tender";

// --- minimal OCDS 1.1.5 release shape (only the fields we read) ----------
export type OcdsIdentifier = {
  scheme?: string;
  id?: string;
};

export type OcdsSupplier = {
  name?: string;
  identifier?: OcdsIdentifier;
};

export type OcdsAward = {
  date?: string;
  value?: { amount?: number; currency?: string };
  suppliers?: OcdsSupplier[];
};

export type OcdsRelease = {
  ocid: string;
  date?: string;
  tender?: { title?: string };
  buyer?: { name?: string };
  awards?: OcdsAward[];
};

export type NormalisedNotice = {
  ocid: string;
  title: string | null;
  noticeDate: string | null;
  value: string | null;
  supplierChNumber: string | null;
  awardDate: string | null;
  contractingAuthority: string | null;
  sourceApi: SourceApi;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Companies House numbers are 8 chars (digits, or 2 letters + 6 digits). */
function normaliseChNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** Strip legal suffixes / punctuation for fuzzy alias comparison (secondary signal only). */
function canonicaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(limited|ltd|llp|plc|group|holdings|uk)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function firstAward(release: OcdsRelease): OcdsAward | undefined {
  return release.awards && release.awards.length > 0 ? release.awards[0] : undefined;
}

function firstSupplier(release: OcdsRelease): OcdsSupplier | undefined {
  const award = firstAward(release);
  return award?.suppliers && award.suppliers.length > 0 ? award.suppliers[0] : undefined;
}

function parseAliases(firm: Firm): string[] {
  try {
    const parsed = JSON.parse(firm.aliases ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// normaliseOcdsRelease — map an OCDS release into a flat NormalisedNotice
// ---------------------------------------------------------------------------
export function normaliseOcdsRelease(
  release: OcdsRelease,
  sourceApi: SourceApi,
): NormalisedNotice {
  const award = firstAward(release);
  const supplier = firstSupplier(release);

  const amount =
    award?.value?.amount !== undefined && award.value.amount !== null
      ? String(award.value.amount)
      : null;

  return {
    ocid: release.ocid,
    title: release.tender?.title ?? null,
    noticeDate: release.date ?? null,
    value: amount,
    supplierChNumber: normaliseChNumber(
      supplier?.identifier?.scheme === "GB-COH" ? supplier.identifier.id : supplier?.identifier?.id,
    ),
    awardDate: award?.date ?? null,
    contractingAuthority: release.buyer?.name ?? null,
    sourceApi,
  };
}

// ---------------------------------------------------------------------------
// matchFirmToSupplier — CH-number match primary (DATA-04), alias fuzzy secondary
// ---------------------------------------------------------------------------
export function matchFirmToSupplier(firm: Firm, release: OcdsRelease): boolean {
  const firmCh = normaliseChNumber(firm.companiesHouseNumber);
  const suppliers = firstAward(release)?.suppliers ?? [];

  // Primary, authoritative signal: Companies House number match.
  if (firmCh) {
    for (const s of suppliers) {
      const supplierCh = normaliseChNumber(s.identifier?.id);
      if (supplierCh && supplierCh === firmCh) return true;
    }
  }

  // Secondary, weaker signal: fuzzy canonical name / alias match.
  const names = [firm.canonicalName, ...parseAliases(firm)].map(canonicaliseName).filter(Boolean);
  for (const s of suppliers) {
    if (!s.name) continue;
    const supplierCanon = canonicaliseName(s.name);
    if (!supplierCanon) continue;
    if (names.some((n) => n === supplierCanon)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// upsertProcurementRecords — normalise, filter to firm-matched, dedup by ocid
// ---------------------------------------------------------------------------
/**
 * Writes deduped, firm-matched procurement records into the cache.
 *
 * Dedup is at write time, keyed on the UNIQUE `ocid` (D-09): a notice present in
 * both Contracts Finder and Find a Tender yields exactly one row. We store both
 * the normalised columns (fast SQL) and the full raw JSON payload (D-10, auditable
 * provenance T-01-12) plus the `sourceApi`.
 *
 * Returns the count of releases that matched the firm and were upserted.
 */
export async function upsertProcurementRecords(
  firm: Firm,
  releases: OcdsRelease[],
  sourceApi: SourceApi,
): Promise<number> {
  let written = 0;

  for (const release of releases) {
    if (!release || !release.ocid) continue;
    if (!matchFirmToSupplier(firm, release)) continue;

    const n = normaliseOcdsRelease(release, sourceApi);

    await db
      .insert(procurementRecords)
      .values({
        firmId: firm.id,
        ocid: n.ocid,
        sourceApi: n.sourceApi,
        title: n.title,
        noticeDate: n.noticeDate,
        value: n.value,
        supplierChNumber: n.supplierChNumber,
        awardDate: n.awardDate,
        contractingAuthority: n.contractingAuthority,
        rawJson: JSON.stringify(release),
      })
      // Dedup keyed on the UNIQUE ocid — same notice across both sources => one row.
      .onConflictDoNothing({ target: procurementRecords.ocid });

    written += 1;
  }

  return written;
}
