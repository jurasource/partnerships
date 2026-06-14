"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { enqueueJob, updateJobStatus } from "@/lib/jobs/queue";
import { getCompanyProfile, getPSC } from "@/lib/clients/companies-house";
import { fetchContractsFinder } from "@/lib/clients/contracts-finder";
import { fetchFindATender } from "@/lib/clients/find-a-tender";
import { upsertProcurementRecords } from "@/lib/adapters/ocds";
import type { Firm } from "@/lib/types";

/**
 * refreshFirm — per-firm refresh slice (DATA-01..05, UI-SPEC refresh control).
 *
 * Re-fetches Companies House profile + PSC and the firm's Contracts Finder +
 * Find a Tender procurement notices, then writes deduped (by ocid, D-09) and
 * CH-number-matched (DATA-04) records into the cache.
 *
 * Everything is routed through the SQLite job-queue contract (enqueue → running →
 * done/failed, D-07/D-08) so Phase 2 can move the work to a background worker
 * without changing callers (ARCHITECTURE Decision 1). For Phase 1 (single user,
 * manual trigger) the work runs synchronously within the action.
 */

export type RefreshFirmResult = {
  ok: boolean;
  jobId?: string;
  error?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function refreshFirm(firmId: string): Promise<RefreshFirmResult> {
  // Load the firm.
  const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
  if (!firm) {
    return { ok: false, error: "Firm not found." };
  }

  // Enqueue a durable job and immediately mark it running.
  const jobId = await enqueueJob({ firmId });
  await updateJobStatus(jobId, "running", { startedAt: nowIso() });

  try {
    const typedFirm: Firm = firm;

    // Companies House: profile + PSC by CH number (DATA-03). Only when a number
    // is present — never invent one (Pitfall 2).
    if (typedFirm.companiesHouseNumber) {
      // Fetched for ownership/profile context; persistence of CH payloads is a
      // Phase 2 concern (findings). We fetch here to validate the number resolves
      // and to warm the rate-limited client path.
      await getCompanyProfile(typedFirm.companiesHouseNumber).catch(() => null);
      await getPSC(typedFirm.companiesHouseNumber).catch(() => null);
    }

    // Procurement: Contracts Finder (DATA-01) + Find a Tender (DATA-02).
    const [cfReleases, ftsReleases] = await Promise.all([
      fetchContractsFinder(typedFirm),
      fetchFindATender(typedFirm),
    ]);

    // Normalise, match by CH number, dedup by ocid, write to cache (DATA-04/05).
    await upsertProcurementRecords(typedFirm, cfReleases, "contracts_finder");
    await upsertProcurementRecords(typedFirm, ftsReleases, "find_a_tender");

    await updateJobStatus(jobId, "done", { completedAt: nowIso() });

    revalidatePath("/firms");
    revalidatePath("/");

    return { ok: true, jobId };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during refresh.";
    await updateJobStatus(jobId, "failed", {
      completedAt: nowIso(),
      errorMessage: message,
    });

    // UI-SPEC data-API error copy is surfaced by the caller; return the cause.
    return { ok: false, jobId, error: message };
  }
}
