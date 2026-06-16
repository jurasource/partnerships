/**
 * Consortium scoring engine (Phase 5).
 *
 * Pure function — no DB calls, no Next.js imports. All signal data is
 * passed in as plain arrays by the route handler.
 *
 * Key invariants:
 * - Conflict exclusion applied before scoring (never after)
 * - ownershipRecord always populated in FirmScoreBreakdown regardless of weight
 * - Tie-breaking is alphabetical by sorted concatenated firm canonicalName
 *
 * Import-clean: no framework-specific imports.
 * Must be importable by Vitest in a Node environment without any Next.js module loading.
 */

import type {
  Firm,
  ConflictPair,
  PartnershipPair,
  OwnershipRecord,
  RiskFlag,
  ProcurementRecord,
} from "@/lib/types";
import type {
  CapabilityMix,
  ScoringWeights,
  TeamRecommendation,
  FirmScoreBreakdown,
} from "./schemas";
import { combinations } from "./combinations";

// ---------------------------------------------------------------------------
// Safe JSON helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON text column that should contain a string array.
 * Returns [] for null, empty string, malformed JSON, or non-array values.
 * Filters out any non-string elements so callers always get string[].
 */
function parseCapabilityTags(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Signal scorers — each returns 0.0–1.0
// ---------------------------------------------------------------------------

/**
 * Contract relevance: proportion of a firm's procurement records with an
 * awardDate within the last 5 years. Returns 0 if the firm has no records.
 */
export function scoreContractRelevance(
  firmId: string,
  procurement: ProcurementRecord[],
  asOf = new Date(),
): number {
  const firmRecords = procurement.filter((r) => r.firmId === firmId);
  if (firmRecords.length === 0) return 0;

  const cutoff = new Date(asOf);
  cutoff.setFullYear(cutoff.getFullYear() - 5);

  const recent = firmRecords.filter(
    (r) => r.awardDate != null && new Date(r.awardDate) >= cutoff,
  ).length;

  return recent / firmRecords.length;
}

/**
 * Capability match: fraction of the requested capability tags that this firm covers.
 * A firm covering all requested tags scores 1.0.
 */
export function scoreCapabilityMatch(firm: Firm, requestedTags: string[]): number {
  if (requestedTags.length === 0) return 1.0;
  const firmTags: string[] = parseCapabilityTags(firm.capabilityTags);
  const matched = requestedTags.filter((tag) => firmTags.includes(tag)).length;
  return matched / requestedTags.length;
}

/**
 * UK ownership / NSI proxy:
 *   1.0 = confirmed UK-incorporated
 *   0.5 = unknown / no record (neutral)
 *   0.0 = confirmed foreign
 */
export function scoreUkOwnership(firmId: string, ownership: OwnershipRecord[]): number {
  const record = ownership.find((o) => o.firmId === firmId);
  if (!record) return 0.5;
  if (record.ukIncorporated === "yes") return 1.0;
  if (record.ukIncorporated === "no") return 0.0;
  return 0.5;
}

/**
 * Risk flags: penalise firms with high-severity flags.
 * Score = 1.0 − (weighted burden / max burden).
 * Severity weights: High=3, Medium=2, Low=1.
 * Returns 1.0 when there are no flags.
 */
export function scoreRiskFlags(firmId: string, riskFlags: RiskFlag[]): number {
  const firmFlags = riskFlags.filter((f) => f.firmId === firmId);
  if (firmFlags.length === 0) return 1.0;

  const severityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  const burden = firmFlags.reduce((sum, f) => sum + (severityWeight[f.severity] ?? 1), 0);
  const maxBurden = firmFlags.length * 3; // worst case: all High

  return 1.0 - burden / maxBurden;
}

/**
 * Past teaming: true if any canonical pair within the team exists in
 * partnershipPairs. Applied at the team level, not per-firm.
 */
export function teamHasPriorPartnerships(
  teamFirmIds: string[],
  partnerships: PartnershipPair[],
): boolean {
  for (let i = 0; i < teamFirmIds.length; i++) {
    for (let j = i + 1; j < teamFirmIds.length; j++) {
      const [a, b] = [teamFirmIds[i], teamFirmIds[j]].sort();
      const found = partnerships.some(
        (p) => [p.firmAId, p.firmBId].sort().join() === [a, b].join(),
      );
      if (found) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Conflict exclusion — O(1) lookup via Set
// ---------------------------------------------------------------------------

/**
 * Build a Set of canonical conflict pair keys for O(1) exclusion during
 * combination generation. Key format: "${minId}__${maxId}" (lexicographic).
 */
export function buildConflictSet(conflicts: ConflictPair[]): Set<string> {
  const set = new Set<string>();
  for (const c of conflicts) {
    const key = [c.firmAId, c.firmBId].sort().join("__");
    set.add(key);
  }
  return set;
}

/**
 * Returns true if any pair within firmIds exists in the conflict Set.
 * Uses O(1) Set lookup — never array.find() inside the loop.
 */
export function hasConflict(firmIds: string[], conflictSet: Set<string>): boolean {
  for (let i = 0; i < firmIds.length; i++) {
    for (let j = i + 1; j < firmIds.length; j++) {
      const key = [firmIds[i], firmIds[j]].sort().join("__");
      if (conflictSet.has(key)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main entry point — interfaces and scoreAndRankCombinations
// ---------------------------------------------------------------------------

export interface ScorerInput {
  capabilityMix: CapabilityMix;
  lockedFirmIds: string[];
  weights: ScoringWeights;
  firms: Firm[];
  conflicts: ConflictPair[];
  partnerships: PartnershipPair[];
  ownership: OwnershipRecord[];
  riskFlags: RiskFlag[];
  procurement: ProcurementRecord[];
}

export interface ScorerResult {
  status: "ok" | "no_valid_team";
  reason?: string;
  recommendations: TeamRecommendation[];
}

export function scoreAndRankCombinations(input: ScorerInput): ScorerResult {
  const {
    capabilityMix,
    lockedFirmIds,
    weights,
    firms: allFirms,
    conflicts,
    partnerships,
    ownership,
    riskFlags,
    procurement,
  } = input;

  // Normalise weights — per-firm signals (contractRelevance, ukOwnership, riskFlags) sum to 1.0
  // amongst themselves. The partnership bonus is applied additively at team level and is
  // scaled independently so it never inflates the per-firm denominator.
  const perFirmRaw = weights.contractRelevance + weights.ukOwnership + weights.riskFlags;
  const perFirmTotal = perFirmRaw === 0 ? 3 : perFirmRaw; // equal-weight fallback
  const w = {
    contractRelevance: weights.contractRelevance / perFirmTotal,
    ukOwnership: weights.ukOwnership / perFirmTotal,
    riskFlags: weights.riskFlags / perFirmTotal,
    // Partnership bonus: 0 when weight=0; scales as a fraction of the total signal pool
    // so a 25/25/25/25 split gives 0.25 bonus (matching the original behaviour) and
    // skewed weights do not distort per-firm scores.
    partnerships: weights.partnerships / (weights.partnerships + perFirmTotal),
  };

  // Build conflict exclusion Set once — O(conflicts), not O(combinations × conflicts)
  const conflictSet = buildConflictSet(conflicts);

  // Expand capabilityMix into a required-slots list
  const requiredSlots: string[] = [];
  for (const [tag, count] of Object.entries(capabilityMix)) {
    for (let i = 0; i < count; i++) requiredSlots.push(tag);
  }
  const teamSize = requiredSlots.length;

  // Identify locked vs unlocked firms
  const lockedFirms = allFirms.filter((f) => lockedFirmIds.includes(f.id));
  const unlockedFirms = allFirms.filter((f) => !lockedFirmIds.includes(f.id));

  // Guard: more firms locked than team slots — reject immediately with a clear error
  if (lockedFirms.length > teamSize) {
    return {
      status: "no_valid_team",
      reason: `${lockedFirms.length} firms are locked but the requested capability mix only requires ${teamSize} slots.`,
      recommendations: [],
    };
  }

  // Generate all combinations of (teamSize - lockedFirms.length) from the unlocked pool
  const slotsToFill = teamSize - lockedFirms.length;
  const candidateCombinations =
    slotsToFill <= 0
      ? [[]] // all slots filled by locked firms
      : combinations(unlockedFirms, slotsToFill);

  const scoredTeams: Array<{
    team: Firm[];
    score: number;
    breakdown: FirmScoreBreakdown[];
  }> = [];

  for (const combo of candidateCombinations) {
    const teamFirms = [...lockedFirms, ...combo];
    const teamIds = teamFirms.map((f) => f.id);

    // Hard exclusion — conflicted pairs never co-recommended (CONS-03 / D-02)
    if (hasConflict(teamIds, conflictSet)) continue;

    // Capability coverage check — team must collectively cover all required slots
    const teamTags = teamFirms.flatMap((f): string[] => parseCapabilityTags(f.capabilityTags));
    const coversAll = requiredSlots.every((slot) => teamTags.includes(slot));
    if (!coversAll) continue;

    // Score each firm across all four signals
    // ownershipRecord is ALWAYS populated regardless of ukOwnership weight (CONS-04 / Pitfall 5)
    const breakdown: FirmScoreBreakdown[] = teamFirms.map((firm) => {
      const contractScore = scoreContractRelevance(firm.id, procurement);
      const ownershipScore = scoreUkOwnership(firm.id, ownership);
      const riskScore = scoreRiskFlags(firm.id, riskFlags);
      const capabilityScore = scoreCapabilityMatch(firm, requiredSlots);

      const firmTotal =
        contractScore * w.contractRelevance +
        ownershipScore * w.ukOwnership +
        riskScore * w.riskFlags +
        capabilityScore * 0; // capability is a gate (coversAll), not a differentiating signal

      return Object.freeze({
        firmId: firm.id,
        firmName: firm.canonicalName,
        signalScores: Object.freeze({
          contractRelevance: contractScore,
          ukOwnership: ownershipScore,
          riskFlags: riskScore,
          capabilityMatch: capabilityScore,
        }),
        weightedTotal: firmTotal,
        // ownershipRecord ALWAYS populated — NSI non-suppression invariant
        ownershipRecord: ownership.find((o) => o.firmId === firm.id) ?? null,
        riskFlagCount: riskFlags.filter((r) => r.firmId === firm.id).length,
        capabilityTags: parseCapabilityTags(firm.capabilityTags),
      });
    });

    // Team score = mean of firm weighted totals + partnership bonus
    const meanFirmScore =
      breakdown.reduce((s, b) => s + b.weightedTotal, 0) / breakdown.length;
    const partnershipBonus = teamHasPriorPartnerships(teamIds, partnerships)
      ? w.partnerships
      : 0;
    const teamScore = meanFirmScore + partnershipBonus;

    scoredTeams.push({ team: teamFirms, score: teamScore, breakdown });
  }

  if (scoredTeams.length === 0) {
    return {
      status: "no_valid_team",
      reason:
        "No valid combination found: all combinations either contain conflicted pairs or do not cover the requested capability mix.",
      recommendations: [],
    };
  }

  // Sort descending by score; tie-break alphabetically by sorted concatenated firm names
  scoredTeams.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const nameA = a.team
      .map((f) => f.canonicalName)
      .sort()
      .join("|");
    const nameB = b.team
      .map((f) => f.canonicalName)
      .sort()
      .join("|");
    return nameA.localeCompare(nameB);
  });

  return {
    status: "ok",
    recommendations: scoredTeams.slice(0, 3).map((s, idx) => ({
      rank: idx + 1,
      score: s.score,
      firms: s.breakdown,
      hasPriorPartnerships: teamHasPriorPartnerships(
        s.team.map((f) => f.id),
        partnerships,
      ),
    })),
  };
}
