/**
 * Unit tests for RecommendRequestSchema, RecommendResponseSchema, and combinations().
 *
 * Tests run without DB or Next.js imports — schemas.ts and combinations.ts are
 * pure Node modules, importable by Vitest directly.
 */

import { describe, it, expect } from "vitest";
import { RecommendRequestSchema, RecommendResponseSchema } from "../schemas";
import { combinations } from "../combinations";

// Zod 4 enforces RFC 4122 UUID format (version bits [1-8], variant bits [89ab])
const VALID_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// ---------------------------------------------------------------------------
// RecommendRequestSchema — valid
// ---------------------------------------------------------------------------

describe("RecommendRequestSchema — valid cases", () => {
  it("parses a valid 1+1+1 body", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
      lockedFirmIds: [],
      weights: {
        contractRelevance: 25,
        ukOwnership: 25,
        partnerships: 25,
        riskFlags: 25,
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults lockedFirmIds to [] when omitted", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: 1, Infrastructure: 0, Nuclear: 0 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lockedFirmIds).toEqual([]);
    }
  });

  it("defaults weights to 25/25/25/25 when omitted", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: 1, Infrastructure: 0, Nuclear: 0 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weights).toEqual({
        contractRelevance: 25,
        ukOwnership: 25,
        partnerships: 25,
        riskFlags: 25,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// RecommendRequestSchema — invalid
// ---------------------------------------------------------------------------

describe("RecommendRequestSchema — invalid cases", () => {
  it("rejects negative capability count", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: -1, Infrastructure: 1, Nuclear: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects capability count > 5", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: 6, Infrastructure: 1, Nuclear: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects all-zero capabilityMix via refine", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: 0, Infrastructure: 0, Nuclear: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects weight > 100", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: 1, Infrastructure: 0, Nuclear: 0 },
      weights: {
        contractRelevance: 101,
        ukOwnership: 25,
        partnerships: 25,
        riskFlags: 25,
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID lockedFirmIds", () => {
    const result = RecommendRequestSchema.safeParse({
      capabilityMix: { Consultancy: 1, Infrastructure: 0, Nuclear: 0 },
      lockedFirmIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RecommendResponseSchema — ok branch
// ---------------------------------------------------------------------------

describe("RecommendResponseSchema — ok branch", () => {
  const validFirmBreakdown = {
    firmId: VALID_UUID,
    firmName: "Alpha Nuclear Ltd",
    signalScores: {
      contractRelevance: 0.6,
      ukOwnership: 1.0,
      riskFlags: 0.5,
      capabilityMatch: 1.0,
    },
    weightedTotal: 0.7,
    ownershipRecord: null,
    riskFlagCount: 1,
    capabilityTags: ["Nuclear"],
  };

  const validTeam = {
    rank: 1,
    score: 0.7,
    firms: [validFirmBreakdown],
    hasPriorPartnerships: false,
  };

  it("accepts status:ok with 1 TeamRecommendation", () => {
    const result = RecommendResponseSchema.safeParse({
      status: "ok",
      recommendations: [validTeam],
    });
    expect(result.success).toBe(true);
  });

  it("rejects status:ok with empty recommendations array", () => {
    const result = RecommendResponseSchema.safeParse({
      status: "ok",
      recommendations: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RecommendResponseSchema — no_valid_team branch
// ---------------------------------------------------------------------------

describe("RecommendResponseSchema — no_valid_team branch", () => {
  it("accepts no_valid_team with reason and empty recommendations", () => {
    const result = RecommendResponseSchema.safeParse({
      status: "no_valid_team",
      reason: "All combinations are conflicted.",
      recommendations: [],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// combinations()
// ---------------------------------------------------------------------------

describe("combinations()", () => {
  it("combinations(['a','b','c'], 2) returns [['a','b'],['a','c'],['b','c']]", () => {
    const result = combinations(["a", "b", "c"], 2);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual(["a", "b"]);
    expect(result).toContainEqual(["a", "c"]);
    expect(result).toContainEqual(["b", "c"]);
  });

  it("combinations(arr, 0) returns [[]]", () => {
    const result = combinations(["a", "b"], 0);
    expect(result).toEqual([[]]);
  });

  it("combinations(['a'], 2) returns []", () => {
    const result = combinations(["a"], 2);
    expect(result).toEqual([]);
  });
});
