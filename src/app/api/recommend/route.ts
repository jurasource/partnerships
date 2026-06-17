import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import {
  firms,
  conflictPairs,
  partnershipPairs,
  ownershipRecords,
  riskFlags,
  procurementRecords,
} from "@/db/schema";
import { RecommendRequestSchema, RecommendResponseSchema } from "@/lib/recommend/schemas";
import { scoreAndRankCombinations } from "@/lib/recommend/scorer";

/**
 * POST /api/recommend
 *
 * Validates the capability mix request, loads all six signal tables in parallel
 * (read-only — never mutates Phase 1–4 data), runs the deterministic pure-function
 * scorer, validates the output contract, and returns a ranked consortium recommendation.
 *
 * CONS-01: returns 1 primary + up to 2 ranked alternatives.
 * CONS-02: per-signal score breakdown per firm in every recommendation.
 * CONS-03: conflict exclusion — conflicted pairs never co-recommended.
 * CONS-04: ownershipRecord always in breakdown regardless of ukOwnership weight.
 * CONS-05: lockedFirmIds always appear in every recommended team.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestStart = Date.now();

  // 1. Parse JSON body — malformed JSON returns 400 immediately
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 2. Validate request shape — Zod 4 safeParse on untrusted input
  const parsed = RecommendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { capabilityMix, lockedFirmIds, weights, poolFirmIds } = parsed.data;

  try {
    // 3. Load all six signal tables in parallel (single Postgres round-trip — never inside a loop)
    const [allFirms, allConflicts, allPartnerships, allOwnership, allRiskFlags, allProcurement] =
      await Promise.all([
        db.select().from(firms),
        db.select().from(conflictPairs),
        db.select().from(partnershipPairs),
        db.select().from(ownershipRecords),
        db.select().from(riskFlags),
        db.select().from(procurementRecords),
      ]);

    // 4a. If poolFirmIds provided, restrict the candidate pool to those firms
    const pooledFirms = poolFirmIds
      ? allFirms.filter((f) => poolFirmIds.includes(f.id))
      : allFirms;

    // 4a. Validate that all locked firm IDs resolve to actual DB rows (CONS-05)
    if (lockedFirmIds.length > 0) {
      const allFirmIdSet = new Set(pooledFirms.map((f) => f.id));
      const missingIds = lockedFirmIds.filter((id) => !allFirmIdSet.has(id));
      if (missingIds.length > 0) {
        return NextResponse.json(
          { error: "One or more locked firm IDs do not exist", missingIds },
          { status: 422 },
        );
      }
    }

    // 4b. Run deterministic pure-function scorer — no DB access inside
    const result = scoreAndRankCombinations({
      capabilityMix,
      lockedFirmIds,
      weights,
      firms: pooledFirms,
      conflicts: allConflicts,
      partnerships: allPartnerships,
      ownership: allOwnership,
      riskFlags: allRiskFlags,
      procurement: allProcurement,
    });

    // 5. Validate scorer output — .parse() not .safeParse() because a contract
    //    violation here is a programming bug, not an input error; throw loudly.
    const validated = RecommendResponseSchema.parse(result);

    const latencyMs = Date.now() - requestStart;

    // 6. Structured log line per AI-SPEC §7
    console.log(
      JSON.stringify({
        event: "recommend.request",
        ts: new Date().toISOString(),
        capabilityMix,
        lockedFirmCount: lockedFirmIds.length,
        weights,
        firmsLoaded: pooledFirms.length,
        conflictsLoaded: allConflicts.length,
        status: validated.status,
        recommendationCount: validated.recommendations.length,
        latencyMs,
      }),
    );

    return NextResponse.json(validated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";

    console.error(
      JSON.stringify({
        event: "recommend.error",
        ts: new Date().toISOString(),
        capabilityMix,
        lockedFirmCount: lockedFirmIds.length,
        weights,
        error: message,
        latencyMs: Date.now() - requestStart,
      }),
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
