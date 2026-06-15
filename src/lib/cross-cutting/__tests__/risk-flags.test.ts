/**
 * Unit tests for extractRiskFlags (PROF-05).
 *
 * Tests must run without ANTHROPIC_API_KEY.
 * All external dependencies mocked via vi.mock().
 *
 * Key behaviours under test:
 * - Reads three risk topics, extracts flags, persists with delete-then-insert
 * - Re-run with fewer flags removes stale flags (Pitfall 1)
 * - NoObjectGeneratedError on one topic does not abort the others
 * - flagType forced by topic category (not trusted from LLM)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_FIRM_ID = "firm-risk-test";

const FINANCIAL_FINDING = {
  id: "finding-fin",
  firmId: MOCK_FIRM_ID,
  topicId: "topic-fin",
  summary: "The firm issued a profit warning in Q3 2023.",
  sourceUrl: "https://example.com/profit-warning",
  sourceTitle: "Profit Warning Announcement",
  rawSnippet: "Revenue down 15% year-on-year.",
  sourceDate: "2023-09-01",
  confidence: "MEDIUM" as const,
  createdAt: "2026-01-01",
};

const REGULATORY_FINDING = {
  id: "finding-reg",
  firmId: MOCK_FIRM_ID,
  topicId: "topic-reg",
  summary: "The firm received an ONR improvement notice in 2022.",
  sourceUrl: "https://example.com/onr-notice",
  sourceTitle: "ONR Enforcement Actions 2022",
  rawSnippet: "Improvement notice issued under Nuclear Installations Act.",
  sourceDate: "2022-06-15",
  confidence: "MEDIUM" as const,
  createdAt: "2026-01-01",
};

const REPUTATION_FINDING = {
  id: "finding-rep",
  firmId: MOCK_FIRM_ID,
  topicId: "topic-rep",
  summary: "No material reputation issues found.",
  sourceUrl: "not-found",
  sourceTitle: "Research worker",
  rawSnippet: "No verifiable source found.",
  sourceDate: null,
  confidence: "HIGH" as const,
  createdAt: "2026-01-01",
};

// Extracted flags from financial finding
const FINANCIAL_FLAGS_RESULT = {
  flags: [
    {
      flagType: "financial" as const,
      severity: "Medium" as const,
      description: "Profit warning issued in Q3 2023 — revenue down 15%.",
      sourceUrl: "https://example.com/profit-warning",
      sourceTitle: "Profit Warning Announcement",
      sourceDate: "2023-09-01",
      rawSnippet: "Revenue down 15% year-on-year.",
    },
  ],
};

const REGULATORY_FLAGS_RESULT = {
  flags: [
    {
      flagType: "regulatory" as const,
      severity: "High" as const,
      description: "ONR improvement notice issued in 2022.",
      sourceUrl: "https://example.com/onr-notice",
      sourceTitle: "ONR Enforcement Actions 2022",
      sourceDate: "2022-06-15",
      rawSnippet: "Improvement notice issued under Nuclear Installations Act.",
    },
  ],
};

const EMPTY_FLAGS_RESULT = { flags: [] };

// ---------------------------------------------------------------------------
// Captured DB operations
// ---------------------------------------------------------------------------

type CapturedOperation = { type: "delete" | "insert"; data?: unknown };
let capturedOperations: CapturedOperation[] = [];

// ---------------------------------------------------------------------------
// Mock DB — capture transaction operations in order
// ---------------------------------------------------------------------------

const mockTx = {
  delete: vi.fn(() => ({
    where: vi.fn(() => {
      capturedOperations.push({ type: "delete" });
      return Promise.resolve();
    }),
  })),
  insert: vi.fn(() => ({
    values: vi.fn((rows: unknown) => {
      capturedOperations.push({ type: "insert", data: rows });
      return Promise.resolve();
    }),
  })),
};

vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => {
      await fn(mockTx);
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/db/schema
// ---------------------------------------------------------------------------

vi.mock("@/db/schema", () => ({
  riskFlags: {
    firmId: "risk_flags.firm_id",
    flagType: "risk_flags.flag_type",
    severity: "risk_flags.severity",
    description: "risk_flags.description",
    sourceUrl: "risk_flags.source_url",
    sourceTitle: "risk_flags.source_title",
    sourceDate: "risk_flags.source_date",
    rawSnippet: "risk_flags.raw_snippet",
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
// Mock topic-lookup helper
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
// Mock Zod schemas (pass through to allow real validation)
// ---------------------------------------------------------------------------

vi.mock("@/lib/cross-cutting/schemas", async () => {
  const actual = await vi.importActual<typeof import("../schemas")>("../schemas");
  return actual;
});

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedOperations = [];
  vi.clearAllMocks();
  mockGenerateText.mockReset();
  mockFindFindingByTopicName.mockResolvedValue(null); // default: no finding
  // Reset transaction mock captures
  mockTx.delete.mockClear();
  mockTx.insert.mockClear();
  // Reset the where/values chains
  mockTx.delete.mockReturnValue({
    where: vi.fn(() => {
      capturedOperations.push({ type: "delete" });
      return Promise.resolve();
    }),
  });
  mockTx.insert.mockReturnValue({
    values: vi.fn((rows: unknown) => {
      capturedOperations.push({ type: "insert", data: rows });
      return Promise.resolve();
    }),
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractRiskFlags — basic extraction", () => {
  it("calls generateText for each finding that is not a not-found sentinel", async () => {
    // REPUTATION_FINDING has sourceUrl "not-found" — it is a sentinel and should be skipped
    // Only financial and regulatory have real findings
    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING) // financial — real finding
      .mockResolvedValueOnce(REGULATORY_FINDING) // regulatory — real finding
      .mockResolvedValueOnce(REPUTATION_FINDING); // reputation — not-found sentinel, skipped

    mockGenerateText
      .mockResolvedValueOnce({ output: FINANCIAL_FLAGS_RESULT })
      .mockResolvedValueOnce({ output: REGULATORY_FLAGS_RESULT });

    const { extractRiskFlags } = await import("../risk-flags");
    await extractRiskFlags(MOCK_FIRM_ID);

    // generateText called only for non-sentinel findings (2, not 3)
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("calls generateText for all 3 topics when all 3 have real findings", async () => {
    const REAL_REPUTATION_FINDING = {
      ...REPUTATION_FINDING,
      sourceUrl: "https://example.com/reputation",
      sourceTitle: "Reputation Report",
      rawSnippet: "No material reputation issues found in public records.",
    };

    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING)
      .mockResolvedValueOnce(REGULATORY_FINDING)
      .mockResolvedValueOnce(REAL_REPUTATION_FINDING);

    mockGenerateText
      .mockResolvedValueOnce({ output: FINANCIAL_FLAGS_RESULT })
      .mockResolvedValueOnce({ output: REGULATORY_FLAGS_RESULT })
      .mockResolvedValueOnce({ output: EMPTY_FLAGS_RESULT });

    const { extractRiskFlags } = await import("../risk-flags");
    await extractRiskFlags(MOCK_FIRM_ID);

    expect(mockGenerateText).toHaveBeenCalledTimes(3);
  });

  it("performs delete-then-insert in a transaction", async () => {
    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING)
      .mockResolvedValueOnce(null) // no regulatory finding
      .mockResolvedValueOnce(null); // no reputation finding

    mockGenerateText.mockResolvedValueOnce({ output: FINANCIAL_FLAGS_RESULT });

    const { extractRiskFlags } = await import("../risk-flags");
    await extractRiskFlags(MOCK_FIRM_ID);

    // Delete must come before insert
    const deleteIdx = capturedOperations.findIndex((op) => op.type === "delete");
    const insertIdx = capturedOperations.findIndex((op) => op.type === "insert");
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(deleteIdx);
  });

  it("forces flagType per topic — does not trust model's flagType field", async () => {
    // Model returns wrong flagType — it should be forced to "financial"
    const wrongFlagType = {
      flags: [
        {
          flagType: "regulatory" as const, // WRONG — model confused
          severity: "Medium" as const,
          description: "Profit warning.",
          sourceUrl: "https://example.com/pw",
          sourceTitle: "PW Report",
          sourceDate: "2023-09-01",
          rawSnippet: "Revenue down.",
        },
      ],
    };

    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING) // financial topic
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mockGenerateText.mockResolvedValueOnce({ output: wrongFlagType });

    const { extractRiskFlags } = await import("../risk-flags");
    await extractRiskFlags(MOCK_FIRM_ID);

    // Find the insert operation and check flagType is forced to "financial"
    const insertOp = capturedOperations.find((op) => op.type === "insert");
    expect(insertOp).toBeDefined();
    const rows = insertOp!.data as Array<{ flagType: string }>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0].flagType).toBe("financial");
  });
});

describe("extractRiskFlags — stale flag removal (Pitfall 1)", () => {
  it("re-run with fewer flags leaves only the new flags (no stale accumulation)", async () => {
    // First run: 2 flags
    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mockGenerateText.mockResolvedValueOnce({
      output: {
        flags: [
          {
            flagType: "financial" as const,
            severity: "Medium" as const,
            description: "Flag 1",
            sourceUrl: "https://example.com/1",
            sourceTitle: "Source 1",
            sourceDate: null,
            rawSnippet: "Snippet 1",
          },
          {
            flagType: "financial" as const,
            severity: "Low" as const,
            description: "Flag 2",
            sourceUrl: "https://example.com/2",
            sourceTitle: "Source 2",
            sourceDate: null,
            rawSnippet: "Snippet 2",
          },
        ],
      },
    });

    const { extractRiskFlags } = await import("../risk-flags");
    await extractRiskFlags(MOCK_FIRM_ID);

    // Verify 2 flags inserted on first run
    const firstInsert = capturedOperations.find((op) => op.type === "insert");
    expect((firstInsert!.data as unknown[]).length).toBe(2);

    // Reset captures for second run
    capturedOperations = [];
    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    // Second run: only 1 flag
    mockGenerateText.mockResolvedValueOnce({
      output: {
        flags: [
          {
            flagType: "financial" as const,
            severity: "Medium" as const,
            description: "Flag 1 updated",
            sourceUrl: "https://example.com/1",
            sourceTitle: "Source 1",
            sourceDate: null,
            rawSnippet: "Snippet 1 updated",
          },
        ],
      },
    });

    await extractRiskFlags(MOCK_FIRM_ID);

    // Delete must have run (removing stale flags)
    const deleteOp = capturedOperations.find((op) => op.type === "delete");
    expect(deleteOp).toBeDefined();

    // Only 1 flag inserted (no stale accumulation)
    const insertOp = capturedOperations.find((op) => op.type === "insert");
    expect(insertOp).toBeDefined();
    expect((insertOp!.data as unknown[]).length).toBe(1);
  });
});

describe("extractRiskFlags — error handling", () => {
  it("NoObjectGeneratedError on one topic does not abort the others", async () => {
    const { NoObjectGeneratedError } = await import("ai");

    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING) // financial — will fail
      .mockResolvedValueOnce(REGULATORY_FINDING) // regulatory — will succeed
      .mockResolvedValueOnce(null); // reputation — no finding

    mockGenerateText
      .mockRejectedValueOnce(
        new NoObjectGeneratedError({
          message: "Schema validation failed",
          text: "bad output",
          response: { id: "r1", timestamp: new Date(), modelId: "m1", headers: {} },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any,
          cause: undefined,
          finishReason: "stop",
        }),
      )
      .mockResolvedValueOnce({ output: REGULATORY_FLAGS_RESULT }); // regulatory succeeds

    const { extractRiskFlags } = await import("../risk-flags");

    // Must not throw — partial failure is graceful
    await expect(extractRiskFlags(MOCK_FIRM_ID)).resolves.toBeUndefined();

    // generateText called for both findings that exist
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("skips generateText call when no finding is found for a topic", async () => {
    mockFindFindingByTopicName
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const { extractRiskFlags } = await import("../risk-flags");
    await extractRiskFlags(MOCK_FIRM_ID);

    // No LLM calls when no findings
    expect(mockGenerateText).not.toHaveBeenCalled();

    // Delete still runs (clears any stale flags from prior runs)
    const deleteOp = capturedOperations.find((op) => op.type === "delete");
    expect(deleteOp).toBeDefined();
  });

  it("persists severity and sourceDate from LLM extraction", async () => {
    mockFindFindingByTopicName
      .mockResolvedValueOnce(FINANCIAL_FINDING)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mockGenerateText.mockResolvedValueOnce({ output: FINANCIAL_FLAGS_RESULT });

    const { extractRiskFlags } = await import("../risk-flags");
    await extractRiskFlags(MOCK_FIRM_ID);

    const insertOp = capturedOperations.find((op) => op.type === "insert");
    expect(insertOp).toBeDefined();
    const rows = insertOp!.data as Array<{ severity: string; sourceDate: string | null }>;
    expect(rows[0].severity).toBe("Medium");
    expect(rows[0].sourceDate).toBe("2023-09-01");
  });
});
