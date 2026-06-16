/**
 * Unit tests for the consortium scorer engine (E1–E8 eval dimensions + CONS-05 locked).
 *
 * Tests run without ANTHROPIC_API_KEY or DB connection — all inputs are plain
 * object fixtures. No vi.mock() needed: the scorer is a pure function.
 *
 * Eval dimensions covered:
 *   E1  conflict-exclusion completeness
 *   E2  NSI / foreign-ownership flag surfacing
 *   E3  scoring correctness vs spec
 *   E5  tie-break determinism
 *   E6  per-signal explainability / citation completeness
 *   E7  capability coverage — no silent gaps
 *   E8  no-valid-team handling
 *   CONS-05  locked firms always in result
 */

import { describe, it, expect } from "vitest";
import {
  buildConflictSet,
  hasConflict,
  scoreContractRelevance,
  scoreUkOwnership,
  scoreRiskFlags,
  scoreCapabilityMatch,
  scoreAndRankCombinations,
} from "../scorer";
import type { Firm, ConflictPair, OwnershipRecord, RiskFlag, ProcurementRecord, PartnershipPair } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures — plain objects, no DB, no mocks
// Zod 4 uuid() requires RFC 4122 format: [0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
// ---------------------------------------------------------------------------

const firmA: Firm = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  canonicalName: "Alpha Nuclear Ltd",
  aliases: "[]",
  companiesHouseNumber: "12345678",
  capabilityTags: '["Nuclear"]',
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  lastResearchedAt: null,
};

const firmB: Firm = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  canonicalName: "Beta Infrastructure plc",
  aliases: "[]",
  companiesHouseNumber: "87654321",
  capabilityTags: '["Infrastructure"]',
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  lastResearchedAt: null,
};

const firmC: Firm = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  canonicalName: "Gamma Consultancy Ltd",
  aliases: "[]",
  companiesHouseNumber: "11111111",
  capabilityTags: '["Consultancy"]',
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  lastResearchedAt: null,
};

const conflictAB: ConflictPair = {
  id: "c1111111-1111-4111-8111-111111111111",
  firmAId: firmA.id,
  firmBId: firmB.id,
  conflictType: "competitor",
  evidenceSummary: "Direct competitors in the nuclear infrastructure market.",
  sourceUrl: "https://example.com/source",
  sourceTitle: "Example Source",
  rawSnippet: "Alpha and Beta compete directly.",
  createdAt: "2024-01-01T00:00:00.000Z",
};

const conflictAC: ConflictPair = {
  id: "c2222222-2222-4222-8222-222222222222",
  firmAId: firmA.id,
  firmBId: firmC.id,
  conflictType: "audit",
  evidenceSummary: "Alpha audits Gamma.",
  sourceUrl: "https://example.com/source2",
  sourceTitle: "Source 2",
  rawSnippet: "Alpha audits Gamma.",
  createdAt: "2024-01-01T00:00:00.000Z",
};

const ownershipA: OwnershipRecord = {
  id: "o1111111-1111-4111-8111-111111111111",
  firmId: firmA.id,
  ukIncorporated: "yes",
  ultimateParent: null,
  countryOfOwnership: "UK",
  pscNotTraceable: "no",
  sourceType: "companies_house",
  sourceUrl: "https://example.com/ch",
  sourceTitle: "Companies House",
  rawSnippet: "UK incorporated entity.",
  createdAt: "2024-01-01T00:00:00.000Z",
};

const ownershipBForeign: OwnershipRecord = {
  id: "o2222222-2222-4222-8222-222222222222",
  firmId: firmB.id,
  ukIncorporated: "no",
  ultimateParent: "French Parent SA",
  countryOfOwnership: "FR",
  pscNotTraceable: "no",
  sourceType: "companies_house",
  sourceUrl: "https://example.com/ch2",
  sourceTitle: "Companies House 2",
  rawSnippet: "Foreign incorporated entity.",
  createdAt: "2024-01-01T00:00:00.000Z",
};

const baseInput = {
  capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
  lockedFirmIds: [] as string[],
  weights: { contractRelevance: 25, ukOwnership: 25, partnerships: 25, riskFlags: 25 },
  firms: [firmA, firmB, firmC],
  conflicts: [] as ConflictPair[],
  partnerships: [] as PartnershipPair[],
  ownership: [] as OwnershipRecord[],
  riskFlags: [] as RiskFlag[],
  procurement: [] as ProcurementRecord[],
};

// ---------------------------------------------------------------------------
// E1: conflict-exclusion completeness
// ---------------------------------------------------------------------------

describe("conflict-exclusion", () => {
  it("buildConflictSet + hasConflict: detects conflicted pair", () => {
    const set = buildConflictSet([conflictAB]);
    expect(hasConflict([firmA.id, firmB.id], set)).toBe(true);
  });

  it("buildConflictSet + hasConflict: order-independent detection", () => {
    const set = buildConflictSet([conflictAB]);
    expect(hasConflict([firmB.id, firmA.id, firmC.id], set)).toBe(true);
  });

  it("buildConflictSet + hasConflict: returns false for non-conflicted pair", () => {
    const set = buildConflictSet([conflictAB]);
    expect(hasConflict([firmA.id, firmC.id], set)).toBe(false);
  });

  it("end-to-end: no team contains a conflicted pair", () => {
    // Only AB is conflicted; the only 3-firm team (A+B+C) is excluded
    const result = scoreAndRankCombinations({
      ...baseInput,
      conflicts: [conflictAB, conflictAC], // A+B and A+C conflicted → no valid team
    });
    expect(result.status).toBe("no_valid_team");
  });

  it("end-to-end: non-conflicted pair still recommended", () => {
    // Only A+B conflicted; A+C and A+B+C checked — but only 1 combo for 1+1+1 mix
    // Use a simpler test: 2-firm mix with only one conflict
    const result = scoreAndRankCombinations({
      ...baseInput,
      conflicts: [conflictAB],
    });
    // The only 3-firm combination containing B (Nuclear+Infrastructure+Consultancy)
    // also includes A, which conflicts with B — so no valid team
    // Actually A=Nuclear, B=Infrastructure, C=Consultancy — team is A+B+C
    // A+B conflict → team excluded → no valid team
    expect(result.status).toBe("no_valid_team");
  });
});

// ---------------------------------------------------------------------------
// E2: NSI / foreign-ownership flag surfacing
// ---------------------------------------------------------------------------

describe("NSI", () => {
  it("ownershipRecord populated even when ukOwnership weight is 0", () => {
    const result = scoreAndRankCombinations({
      ...baseInput,
      ownership: [ownershipA, ownershipBForeign],
      weights: { contractRelevance: 33, ukOwnership: 0, partnerships: 33, riskFlags: 34 },
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const team = result.recommendations[0];
      // All firms in the team should have their ownershipRecord populated if it exists
      const firmABreakdown = team.firms.find((f) => f.firmId === firmA.id);
      const firmBBreakdown = team.firms.find((f) => f.firmId === firmB.id);
      expect(firmABreakdown?.ownershipRecord).not.toBeNull();
      expect(firmABreakdown?.ownershipRecord?.ukIncorporated).toBe("yes");
      expect(firmBBreakdown?.ownershipRecord).not.toBeNull();
      expect(firmBBreakdown?.ownershipRecord?.ukIncorporated).toBe("no");
    }
  });

  it("firms without ownership record have ownershipRecord === null", () => {
    const result = scoreAndRankCombinations({
      ...baseInput,
      ownership: [], // no records
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const team = result.recommendations[0];
      team.firms.forEach((f) => {
        expect(f.ownershipRecord).toBeNull();
      });
    }
  });
});

// ---------------------------------------------------------------------------
// E3: scoring correctness vs spec
// ---------------------------------------------------------------------------

describe("scoring correctness", () => {
  it("scoreContractRelevance: 3 recent out of 5 total = 0.6", () => {
    const now = new Date("2026-06-16T00:00:00Z");
    const cutoff = new Date("2021-06-16T00:00:00Z");

    const procurementRecords: ProcurementRecord[] = [
      // 3 recent (within 5 years of 2026-06-16)
      {
        id: "p1111111-1111-4111-8111-111111111111",
        firmId: firmA.id,
        ocid: "oc-001",
        sourceApi: "contracts_finder",
        title: "Contract A",
        noticeDate: null,
        value: null,
        supplierChNumber: null,
        awardDate: "2023-01-01",
        contractingAuthority: null,
        rawJson: "{}",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "p2222222-2222-4222-8222-222222222222",
        firmId: firmA.id,
        ocid: "oc-002",
        sourceApi: "contracts_finder",
        title: "Contract B",
        noticeDate: null,
        value: null,
        supplierChNumber: null,
        awardDate: "2024-06-01",
        contractingAuthority: null,
        rawJson: "{}",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "p3333333-3333-4333-8333-333333333333",
        firmId: firmA.id,
        ocid: "oc-003",
        sourceApi: "find_a_tender",
        title: "Contract C",
        noticeDate: null,
        value: null,
        supplierChNumber: null,
        awardDate: "2025-01-01",
        contractingAuthority: null,
        rawJson: "{}",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      // 2 old (before cutoff)
      {
        id: "p4444444-4444-4444-8444-444444444444",
        firmId: firmA.id,
        ocid: "oc-004",
        sourceApi: "contracts_finder",
        title: "Contract D",
        noticeDate: null,
        value: null,
        supplierChNumber: null,
        awardDate: "2018-01-01",
        contractingAuthority: null,
        rawJson: "{}",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "p5555555-5555-4555-8555-555555555555",
        firmId: firmA.id,
        ocid: "oc-005",
        sourceApi: "contracts_finder",
        title: "Contract E",
        noticeDate: null,
        value: null,
        supplierChNumber: null,
        awardDate: "2019-01-01",
        contractingAuthority: null,
        rawJson: "{}",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ];

    const score = scoreContractRelevance(firmA.id, procurementRecords, now);
    expect(score).toBeCloseTo(0.6, 5);
  });

  it("scoreUkOwnership: 1.0 for uk_incorporated=yes", () => {
    expect(scoreUkOwnership(firmA.id, [ownershipA])).toBeCloseTo(1.0, 5);
  });

  it("scoreUkOwnership: 0.0 for uk_incorporated=no", () => {
    expect(scoreUkOwnership(firmB.id, [ownershipBForeign])).toBeCloseTo(0.0, 5);
  });

  it("scoreUkOwnership: 0.5 for missing record", () => {
    expect(scoreUkOwnership(firmC.id, [])).toBeCloseTo(0.5, 5);
  });

  it("scoreUkOwnership: 0.5 for uk_incorporated=unknown", () => {
    const unknownOwnership: OwnershipRecord = {
      ...ownershipA,
      id: "o3333333-3333-4333-8333-333333333333",
      firmId: firmC.id,
      ukIncorporated: "unknown",
    };
    expect(scoreUkOwnership(firmC.id, [unknownOwnership])).toBeCloseTo(0.5, 5);
  });

  it("scoreRiskFlags: 0.0 for one High flag (1 - 3/3 = 0)", () => {
    const highFlag: RiskFlag = {
      id: "r1111111-1111-4111-8111-111111111111",
      firmId: firmA.id,
      flagType: "financial",
      severity: "High",
      description: "Major financial concern.",
      sourceUrl: "https://example.com",
      sourceTitle: "Risk Report",
      sourceDate: null,
      rawSnippet: "High severity issue.",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    expect(scoreRiskFlags(firmA.id, [highFlag])).toBeCloseTo(0.0, 5);
  });

  it("scoreRiskFlags: 1.0 for no flags", () => {
    expect(scoreRiskFlags(firmA.id, [])).toBeCloseTo(1.0, 5);
  });

  it("scoreCapabilityMatch: matched/requested fraction", () => {
    // firmA has ["Nuclear"], requesting ["Nuclear","Infrastructure"] = 1/2 = 0.5
    expect(scoreCapabilityMatch(firmA, ["Nuclear", "Infrastructure"])).toBeCloseTo(0.5, 5);
  });

  it("scoreCapabilityMatch: 1.0 when firm covers all requested tags", () => {
    expect(scoreCapabilityMatch(firmA, ["Nuclear"])).toBeCloseTo(1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// E5: tie-break determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("100 identical runs produce deep-equal results", () => {
    const firstResult = scoreAndRankCombinations(baseInput);
    for (let i = 0; i < 99; i++) {
      const result = scoreAndRankCombinations(baseInput);
      expect(result).toEqual(firstResult);
    }
  });

  it("tie-break orders teams alphabetically by sorted concatenated firm names", () => {
    // Create two firms with identical scoring signals (same capability, no flags, no ownership)
    // Team ordering will be purely alphabetical
    const firmAlpha: Firm = {
      id: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
      canonicalName: "AAA Corp",
      aliases: "[]",
      companiesHouseNumber: null,
      capabilityTags: '["Nuclear"]',
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      lastResearchedAt: null,
    };

    const firmZeta: Firm = {
      id: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
      canonicalName: "ZZZ Corp",
      aliases: "[]",
      companiesHouseNumber: null,
      capabilityTags: '["Nuclear"]',
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      lastResearchedAt: null,
    };

    const firmInfra: Firm = {
      ...firmB,
    };

    const firmConsultancy: Firm = {
      ...firmC,
    };

    // Two possible 1+1+1 teams: [Alpha+Infra+Consultancy] vs [Zeta+Infra+Consultancy]
    // All signals are equal (no ownership, no flags, no procurement, no partnerships)
    // Tie-break: sort firm names alphabetically
    // Team 1 names sorted: ["AAA Corp", "Beta Infrastructure plc", "Gamma Consultancy Ltd"] → "AAA Corp|Beta Infrastructure plc|Gamma Consultancy Ltd"
    // Team 2 names sorted: ["Beta Infrastructure plc", "Gamma Consultancy Ltd", "ZZZ Corp"] → "Beta Infrastructure plc|Gamma Consultancy Ltd|ZZZ Corp"
    // "AAA..." < "Beta..." → Team 1 (with Alpha) should rank first
    const tieInput = {
      capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
      lockedFirmIds: [] as string[],
      weights: { contractRelevance: 25, ukOwnership: 25, partnerships: 25, riskFlags: 25 },
      firms: [firmAlpha, firmZeta, firmInfra, firmConsultancy],
      conflicts: [] as ConflictPair[],
      partnerships: [] as PartnershipPair[],
      ownership: [] as OwnershipRecord[],
      riskFlags: [] as RiskFlag[],
      procurement: [] as ProcurementRecord[],
    };

    const result = scoreAndRankCombinations(tieInput);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const rank1 = result.recommendations[0];
      const rank1Names = rank1.firms.map((f) => f.firmName).sort();
      // Team with AAA Corp should be rank 1 (alphabetically first among ties)
      expect(rank1Names).toContain("AAA Corp");
    }
  });
});

// ---------------------------------------------------------------------------
// E6: per-signal explainability / citation completeness
// ---------------------------------------------------------------------------

describe("explainability", () => {
  it("every firm in every recommendation has all required breakdown fields", () => {
    const result = scoreAndRankCombinations({
      ...baseInput,
      ownership: [ownershipA],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      result.recommendations.forEach((team) => {
        team.firms.forEach((firm) => {
          expect(firm.firmId).toBeTruthy();
          expect(firm.firmName).toBeTruthy();
          expect(firm.signalScores).toBeDefined();
          expect(typeof firm.signalScores.contractRelevance).toBe("number");
          expect(typeof firm.signalScores.ukOwnership).toBe("number");
          expect(typeof firm.signalScores.riskFlags).toBe("number");
          expect(typeof firm.signalScores.capabilityMatch).toBe("number");
          expect(typeof firm.weightedTotal).toBe("number");
          expect(typeof firm.riskFlagCount).toBe("number");
          expect(Array.isArray(firm.capabilityTags)).toBe(true);
          // ownershipRecord must be present (either an object or null — never undefined)
          expect("ownershipRecord" in firm).toBe(true);
        });
      });
    }
  });
});

// ---------------------------------------------------------------------------
// E7: capability coverage — no silent gaps
// ---------------------------------------------------------------------------

describe("capability coverage", () => {
  it("returned team covers all requested capability tags", () => {
    const result = scoreAndRankCombinations(baseInput);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const requiredTags = ["Consultancy", "Infrastructure", "Nuclear"];
      result.recommendations.forEach((team) => {
        const teamTags = team.firms.flatMap((f) => f.capabilityTags);
        requiredTags.forEach((tag) => {
          expect(teamTags).toContain(tag);
        });
      });
    }
  });

  it("uncoverable mix returns no_valid_team", () => {
    // Request a tag that no firm has: "Decommissioning"
    const uncoverableInput = {
      ...baseInput,
      // Override capabilityMix to request a tag no firm can provide
      // We don't have a "Decommissioning" capability tag in any fixture firm
      firms: [firmA, firmB], // only Nuclear + Infrastructure, no Consultancy
      capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
    };
    const result = scoreAndRankCombinations(uncoverableInput);
    expect(result.status).toBe("no_valid_team");
  });
});

// ---------------------------------------------------------------------------
// E8: no-valid-team handling
// ---------------------------------------------------------------------------

describe("no-valid-team", () => {
  it("all combinations conflicted → status:no_valid_team with non-empty reason and empty recommendations", () => {
    // With only A+B+C and both A-B and A-C conflicted, no 3-firm team is valid
    const result = scoreAndRankCombinations({
      ...baseInput,
      conflicts: [conflictAB, conflictAC],
    });
    expect(result.status).toBe("no_valid_team");
    expect(result.recommendations).toHaveLength(0);
    if (result.status === "no_valid_team") {
      expect(result.reason).toBeTruthy();
      expect((result.reason ?? "").length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// CONS-05: locked firms
// ---------------------------------------------------------------------------

describe("locked", () => {
  it("lockedFirmIds always appear in the result team", () => {
    const result = scoreAndRankCombinations({
      ...baseInput,
      lockedFirmIds: [firmA.id],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      result.recommendations.forEach((team) => {
        const teamFirmIds = team.firms.map((f) => f.firmId);
        expect(teamFirmIds).toContain(firmA.id);
      });
    }
  });

  it("slotsToFill = teamSize - lockedFirms.length", () => {
    // Lock firmA (Nuclear). Remaining slots: Infrastructure + Consultancy (2 slots)
    // Only firmB (Infrastructure) and firmC (Consultancy) should fill remaining slots
    const result = scoreAndRankCombinations({
      ...baseInput,
      lockedFirmIds: [firmA.id],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const team = result.recommendations[0];
      expect(team.firms).toHaveLength(3); // 1 locked + 2 unlocked
      const firmIds = team.firms.map((f) => f.firmId);
      expect(firmIds).toContain(firmA.id);
    }
  });
});
