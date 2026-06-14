
import { desc } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { procurementRecords } from "@/db/schema";
import { getCompanyProfile, getPSC } from "@/lib/clients/companies-house";
import type { Firm } from "@/lib/types";

/**
 * Grounding context builder — assembles Companies House + OCDS data for a firm
 * into a compact, human-readable block for the AI synthesis prompt.
 *
 * Per AI-SPEC §4b Context Window Management:
 * - CH profile: ~200 tokens (status, jurisdiction, PSC nationality summary)
 * - OCDS procurement records: top 10 by noticeDate DESC, ~500 tokens total
 * - Formatted as readable text, NOT raw JSON (AI-SPEC §4b "what not to do")
 *
 * Errors from CH API are caught and gracefully omitted (never throw on missing data).
 * This mirrors the error handling pattern in refresh-actions.ts.
 */

export type GroundingContext = {
  firmName: string;
  companiesHouseNumber: string | null;
  chSummary: string;
  procurementSummary: string;
};

export async function buildGroundingContext(firm: Firm): Promise<GroundingContext> {
  const firmName = firm.canonicalName;
  const chNumber = firm.companiesHouseNumber;

  // Fetch CH profile and PSC data — catch errors, never throw (mirrors refresh-actions.ts)
  let chSummary = "Companies House number not available.";

  if (chNumber) {
    try {
      const [profile, psc] = await Promise.all([
        getCompanyProfile(chNumber).catch(() => null),
        getPSC(chNumber).catch(() => null),
      ]);

      const lines: string[] = [];

      if (profile) {
        lines.push(`Company number: ${profile.company_number}`);
        lines.push(`Status: ${profile.company_status ?? "unknown"}`);
        if (profile.jurisdiction) {
          lines.push(`Jurisdiction: ${profile.jurisdiction}`);
        }
        if (profile.registered_office_address?.country) {
          lines.push(`Country: ${profile.registered_office_address.country}`);
        }
        if (profile.date_of_creation) {
          lines.push(`Incorporated: ${profile.date_of_creation}`);
        }
      }

      if (psc?.items && psc.items.length > 0) {
        const totalPscs = psc.items.length;

        // Separate natural persons from corporate PSCs — they use different fields
        // for ownership origin (CR-04). Corporate PSCs have no `nationality` field;
        // checking `nationality` alone silently skips all corporate parent entities.
        const UK_NATURAL_PERSON_TERMS = [
          "british", "english", "scottish", "welsh", "northern irish",
          "united kingdom",
        ];

        const naturalPersonNonUk = psc.items.filter((item) => {
          // Corporate-entity kind — handled separately below
          if (item.kind?.toLowerCase().includes("corporate-entity")) return false;
          // No nationality field at all — flag conservatively as non-UK
          if (!item.nationality) return true;
          const nat = item.nationality.toLowerCase();
          return !UK_NATURAL_PERSON_TERMS.some((term) => nat.includes(term));
        });

        const UK_COUNTRY_TERMS = [
          "england", "scotland", "wales", "northern ireland",
          "united kingdom", "england and wales",
        ];

        const corporatePscs = psc.items.filter((item) =>
          item.kind?.toLowerCase().includes("corporate-entity"),
        );
        const corporateNonUk = corporatePscs.filter((item) => {
          const country = (item.country_of_residence ?? "").toLowerCase();
          if (!country) return true; // unknown origin — flag conservatively
          return !UK_COUNTRY_TERMS.some((term) => country === term);
        });

        const nonUkCount = naturalPersonNonUk.length + corporateNonUk.length;

        lines.push(
          `PSC register: ${totalPscs} person(s) with significant control; ` +
            `${nonUkCount} non-UK / non-UK-corporate PSC(s)`,
        );

        if (naturalPersonNonUk.length > 0) {
          const nationalities = naturalPersonNonUk
            .map((p) => p.nationality ?? "unknown nationality")
            .join(", ");
          lines.push(`Non-UK PSC nationalities (natural persons): ${nationalities}`);
        }

        if (corporateNonUk.length > 0) {
          const names = corporateNonUk
            .map((p) => p.name ?? "unnamed corporate PSC")
            .join(", ");
          lines.push(`Non-UK corporate PSC(s): ${names}`);
        }

        if (corporatePscs.length > 0 && corporateNonUk.length === 0) {
          const names = corporatePscs
            .map((p) => p.name ?? "unnamed corporate PSC")
            .join(", ");
          lines.push(`UK corporate PSC(s): ${names}`);
        }
      }

      chSummary = lines.length > 0 ? lines.join("\n") : "No Companies House data available.";
    } catch {
      chSummary = "Companies House data could not be retrieved.";
    }
  }

  // Fetch top 10 procurement records by noticeDate DESC
  let procurementSummary = "No procurement records found.";

  try {
    const records = await db
      .select()
      .from(procurementRecords)
      .where(eq(procurementRecords.firmId, firm.id))
      .orderBy(desc(procurementRecords.noticeDate))
      .limit(10);

    if (records.length > 0) {
      const totalNote =
        records.length === 10 ? `Showing 10 most recent procurement records.` : "";
      const bullets = records.map((r) => {
        const title = (r.title ?? "Untitled").slice(0, 80);
        const parts: string[] = [`- ${title}`];
        if (r.noticeDate) parts.push(`(${r.noticeDate})`);
        if (r.value) parts.push(`Value: ${r.value}`);
        if (r.contractingAuthority) parts.push(`Authority: ${r.contractingAuthority}`);
        if (r.sourceApi) parts.push(`[${r.sourceApi}]`);
        return parts.join(" ");
      });
      procurementSummary = [totalNote, ...bullets].filter(Boolean).join("\n");
    }
  } catch {
    procurementSummary = "Procurement records could not be retrieved.";
  }

  return {
    firmName,
    companiesHouseNumber: chNumber,
    chSummary,
    procurementSummary,
  };
}

/**
 * Format the grounding context as a human-readable block string.
 *
 * Returns formatted text, NOT raw JSON (AI-SPEC §4b "what not to do").
 */
export function formatGroundingContext(ctx: GroundingContext): string {
  const lines: string[] = [];

  lines.push(`Firm: ${ctx.firmName}`);
  if (ctx.companiesHouseNumber) {
    lines.push(`Companies House Number: ${ctx.companiesHouseNumber}`);
  }
  lines.push("");
  lines.push("=== Companies House Profile ===");
  lines.push(ctx.chSummary);
  lines.push("");
  lines.push("=== UK Procurement Records ===");
  lines.push(ctx.procurementSummary);

  return lines.join("\n");
}
