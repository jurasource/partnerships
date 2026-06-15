/**
 * Unit tests for extractConflicts (ANAL-01) and resolveFirmName.
 *
 * Tests must run without ANTHROPIC_API_KEY.
 * All external dependencies mocked via vi.mock().
 *
 * Key behaviours under test:
 * - Conflict naming a real firm is stored with canonical ordering
 * - Conflict naming a non-existent firm is discarded (Pitfall 3 — fabricated name rejection)
 * - Empty extraction (no explicit conflict evidence) stores nothing
 * - Canonical pair ordering: firmAId < firmBId
 * - Conflicts from both "Partnerships and JVs" and "Reputation and controversy" findings are processed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIRM_A = "firm-aardvark"; // less than firm-zebra
const FIRM_B = "firm-zebra";
const REAL_FIRM_CANONICAL = "Nuclear Engineering Co";
const REAL_FIRM_ALIAS = "NEC";

// Mock DB firms table — two real firms
const MOCK_FIRMS = [
  {
    id: FIRM_A,
    canonicalName: "Aardvark Nuclear Ltd",
    aliases: JSON.stringify(["ANL", "Aardvark"]),
    companiesHouseNumber: "12345678",
    capabilityTags: "[]",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    lastResearchedAt: null,
  },
  {
    id: FIRM_B,
    canonicalName: REAL_FIRM_CANONICAL,
    aliases: JSON.stringify([REAL_FIRM_ALIAS, "Nuclear Eng"]),
    companiesHouseNumber: "87654321",
    capabilityTags: "[]",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    lastResearchedAt: null,
  },
];

// Partnerships finding mentioning a real firm conflict
const PARTNERSHIPS_FINDING_WITH_CONFLICT = {
  id: "finding-pvj",
  firmId: FIRM_A,
  topicId: "topic-pvj",
  summary: "Aardvark Nuclear Ltd competes directly with Nuclear Engineering Co in the decommissioning sector.",
  sourceUrl: "https://example.com/sector-report",
  sourceTitle: "UK Nuclear Sector Report 2024",
  rawSnippet: "Aardvark and NEC are direct competitors for Magnox decommissioning contracts.",
  sourceDate: "2024-01-15",
  confidence: "MEDIUM" as const,
  createdAt: "2026-01-01",
};

// Reputation finding (no conflict evidence)
const REPUTATION_FINDING_EMPTY = {
  id: "finding-rep",
  firmId: FIRM_A,
  topicId: "topic-rep",
  summary: "No material reputation issues found.",
  sourceUrl: "not-found",
  sourceTitle: "Research worker",
  rawSnippet: "No verifiable source found.",
  sourceDate: null,
  confidence: "HIGH" as const,
  createdAt: "2026-01-01",
};

// LLM extraction result mentioning one real firm and one fabricated firm
const EXTRACTION_WITH_REAL_AND_FABRICATED = {
  conflicts: [
    {
      otherFirmName: REAL_FIRM_CANONICAL, // resolves to FIRM_B
      conflictType: "competitor" as const,
      evidenceSummary: "Direct competitors for Magnox decommissioning contracts.",
      sourceUrl: "https://example.com/sector-report",
      sourceTitle: "UK Nuclear Sector Report 2024",
      rawSnippet: "Aardvark and NEC are direct competitors for Magnox decommissioning contracts.",
    },
    {
      otherFirmName: "Nonexistent Fabricated Firm PLC", // will not resolve — should be discarded
      conflictType: "competitor" as const,
      evidenceSummary: "Fabricated conflict evidence.",
      sourceUrl: "https://example.com/fabricated",
      sourceTitle: "Fabricated Source",
      rawSnippet: "This firm does not exist in the database.",
    },
  ],
};

const EXTRACTION_EMPTY = { conflicts: [] };

// ---------------------------------------------------------------------------
// Captured DB writes
// ---------------------------------------------------------------------------

type InsertedRow = Record<string, unknown>;
let capturedInserts: InsertedRow[] = [];
let capturedUpsertCalls = 0;

// ---------------------------------------------------------------------------
// Mock @/db/client — select returns firms table; insert captures conflict_pairs
// ---------------------------------------------------------------------------

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        // No where — returns all firms (used by resolveFirmName)
        then: vi.fn((fn: (rows: typeof MOCK_FIRMS) => unknown) => fn(MOCK_FIRMS)),
        // Returns all firms from .from() directly (without .where())
        [Symbol.iterator]: undefined,
        // Support array-like resolution
        where: vi.fn(() => Promise.resolve([MOCK_FIRMS[0]])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((row: InsertedRow) => {
        capturedInserts.push({ ...row });
        return {
          onConflictDoUpdate: vi.fn(() => {
            capturedUpsertCalls++;
            return Promise.resolve();
          }),
        };
      }),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/db/schema
// ---------------------------------------------------------------------------

vi.mock("@/db/schema", () => ({
  firms: {
    id: "firms.id",
    canonicalName: "firms.canonical_name",
    aliases: "firms.aliases",
  },
  conflictPairs: {
    firmAId: "conflict_pairs.firm_a_id",
    firmBId: "conflict_pairs.firm_b_id",
    conflictType: "conflict_pairs.conflict_type",
    evidenceSummary: "conflict_pairs.evidence_summary",
    sourceUrl: "conflict_pairs.source_url",
    sourceTitle: "conflict_pairs.source_title",
    rawSnippet: "conflict_pairs.raw_snippet",
  },
}));

// ---------------------------------------------------------------------------
// Mock drizzle-orm
// ---------------------------------------------------------------------------

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => "eq-stub"),
  and: vi.fn((..._args: unknown[]) => "and-stub"),
}));

// ---------------------------------------------------------------------------
// Mock AI module
// ---------------------------------------------------------------------------

const mockGenerateText = vi.fn();

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => ({ provider: "anthropic-mock", modelId: "claude-sonnet-4-6" })),
}));

// ---------------------------------------------------------------------------
// Mock topic-lookup helper — controls which findings are returned
// ---------------------------------------------------------------------------

const mockFindFindingByTopicName = vi.fn();

vi.mock("@/lib/cross-cutting/topic-lookup", () => ({
  findFindingByTopicName: mockFindFindingByTopicName,
  TOPIC_NAMES: {
    ownership: "Ownership structure",
    financial: "Financial health",
    regulatory: "Regulatory approvals",
    reputation: "Reputation and controversy",
    partnerships: "Partnerships and JVs",
  },
}));

// ---------------------------------------------------------------------------
// Mock schemas (pass through for real validation)
// ---------------------------------------------------------------------------

vi.mock("@/lib/cross-cutting/schemas", async () => {
  const actual = await vi.importActual<typeof import("../schemas")>("../schemas");
  return actual;
});

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedInserts = [];
  capturedUpsertCalls = 0;
  vi.clearAllMocks();
  mockGenerateText.mockReset();
  mockFindFindingByTopicName.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractConflicts — real firm stored, fabricated firm discarded", () => {
  it("stores the real conflict pair and discards the fabricated firm name", async () => {
    // Set up the select mock for resolveFirmName: returns all firms
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    dbMock.select.mockReturnValue({
      from: vi.fn(() => Promise.resolve(MOCK_FIRMS)),
    });

    mockFindFindingByTopicName
      .mockResolvedValueOnce(PARTNERSHIPS_FINDING_WITH_CONFLICT) // partnerships
      .mockResolvedValueOnce(REPUTATION_FINDING_EMPTY); // reputation

    mockGenerateText
      .mockResolvedValueOnce({ output: EXTRACTION_WITH_REAL_AND_FABRICATED })
      .mockResolvedValueOnce({ output: EXTRACTION_EMPTY });

    const { extractConflicts } = await import("../conflicts");
    await extractConflicts(FIRM_A);

    // Only the real conflict should be stored (fabricated name discarded)
    expect(capturedInserts.length).toBe(1);
    const row = capturedInserts[0];
    expect(row.conflictType).toBe("competitor");
  });

  it("stores conflict pair with canonical ordering (firmAId < firmBId)", async () => {
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    dbMock.select.mockReturnValue({
      from: vi.fn(() => Promise.resolve(MOCK_FIRMS)),
    });

    mockFindFindingByTopicName
      .mockResolvedValueOnce(PARTNERSHIPS_FINDING_WITH_CONFLICT)
      .mockResolvedValueOnce(null);

    mockGenerateText.mockResolvedValueOnce({ output: EXTRACTION_WITH_REAL_AND_FABRICATED });

    const { extractConflicts } = await import("../conflicts");
    await extractConflicts(FIRM_A);

    expect(capturedInserts.length).toBe(1);
    const row = capturedInserts[0];
    // FIRM_A="firm-aardvark" < FIRM_B="firm-zebra"
    expect(row.firmAId).toBe(FIRM_A);
    expect(row.firmBId).toBe(FIRM_B);
  });

  it("uses onConflictDoUpdate for upsert on conflict_pairs unique index", async () => {
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    dbMock.select.mockReturnValue({
      from: vi.fn(() => Promise.resolve(MOCK_FIRMS)),
    });

    mockFindFindingByTopicName
      .mockResolvedValueOnce(PARTNERSHIPS_FINDING_WITH_CONFLICT)
      .mockResolvedValueOnce(null);

    mockGenerateText.mockResolvedValueOnce({ output: EXTRACTION_WITH_REAL_AND_FABRICATED });

    const { extractConflicts } = await import("../conflicts");
    await extractConflicts(FIRM_A);

    expect(capturedUpsertCalls).toBeGreaterThan(0);
  });
});

describe("extractConflicts — empty extraction stores nothing", () => {
  it("does not insert any rows when LLM returns empty conflicts array", async () => {
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    dbMock.select.mockReturnValue({
      from: vi.fn(() => Promise.resolve(MOCK_FIRMS)),
    });

    mockFindFindingByTopicName
      .mockResolvedValueOnce(PARTNERSHIPS_FINDING_WITH_CONFLICT)
      .mockResolvedValueOnce(null);

    mockGenerateText.mockResolvedValueOnce({ output: EXTRACTION_EMPTY });

    const { extractConflicts } = await import("../conflicts");
    await extractConflicts(FIRM_A);

    expect(capturedInserts.length).toBe(0);
  });

  it("does not throw when both findings are absent", async () => {
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    dbMock.select.mockReturnValue({
      from: vi.fn(() => Promise.resolve(MOCK_FIRMS)),
    });

    mockFindFindingByTopicName
      .mockResolvedValueOnce(null) // no partnerships finding
      .mockResolvedValueOnce(null); // no reputation finding

    const { extractConflicts } = await import("../conflicts");
    await expect(extractConflicts(FIRM_A)).resolves.toBeUndefined();

    // No LLM calls needed when no findings
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(capturedInserts.length).toBe(0);
  });
});

describe("extractConflicts — alias resolution", () => {
  it("resolves firm by alias (not just canonicalName)", async () => {
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    dbMock.select.mockReturnValue({
      from: vi.fn(() => Promise.resolve(MOCK_FIRMS)),
    });

    const aliasBasedExtraction = {
      conflicts: [
        {
          otherFirmName: REAL_FIRM_ALIAS, // alias, not canonical name
          conflictType: "competitor" as const,
          evidenceSummary: "Compete for same contracts.",
          sourceUrl: "https://example.com/sector-report",
          sourceTitle: "Sector Report",
          rawSnippet: "NEC competes with Aardvark.",
        },
      ],
    };

    mockFindFindingByTopicName
      .mockResolvedValueOnce(PARTNERSHIPS_FINDING_WITH_CONFLICT)
      .mockResolvedValueOnce(null);

    mockGenerateText.mockResolvedValueOnce({ output: aliasBasedExtraction });

    const { extractConflicts } = await import("../conflicts");
    await extractConflicts(FIRM_A);

    // The alias "NEC" should resolve to FIRM_B and the pair should be stored
    expect(capturedInserts.length).toBe(1);
    const row = capturedInserts[0];
    expect(row.firmAId).toBe(FIRM_A);
    expect(row.firmBId).toBe(FIRM_B);
  });
});

describe("canonicalPair helper", () => {
  it("returns [id1, id2] when id1 < id2 lexicographically", async () => {
    const { canonicalPair } = await import("../conflicts");
    expect(canonicalPair("aaa", "bbb")).toEqual(["aaa", "bbb"]);
  });

  it("returns [id2, id1] when id2 < id1 lexicographically", async () => {
    const { canonicalPair } = await import("../conflicts");
    expect(canonicalPair("zzz", "aaa")).toEqual(["aaa", "zzz"]);
  });

  it("handles equal ids (edge case — same firm)", async () => {
    const { canonicalPair } = await import("../conflicts");
    expect(canonicalPair("same", "same")).toEqual(["same", "same"]);
  });
});
