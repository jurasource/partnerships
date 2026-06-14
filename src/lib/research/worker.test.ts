/**
 * Research worker invariant tests (E1/E2/no-LOW/topic-coverage).
 *
 * These tests MUST run without TAVILY_API_KEY or ANTHROPIC_API_KEY set.
 * The worker is tested via dependency-injection (stub WebSearchClient) and
 * vi.mock('ai') to control generateText output.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebSearchResult } from "@/lib/search/types";
import { NOT_FOUND_SENTINEL, FindingSchema } from "./schemas";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const MOCK_FIRM = {
  id: "firm-abc",
  canonicalName: "Test Firm Ltd",
  aliases: "[]",
  companiesHouseNumber: "12345678",
  capabilityTags: "[]",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: null,
};

const MOCK_TOPICS = [
  { id: "topic-1", name: "UK nuclear capability", description: "Topic 1", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "topic-2", name: "Past government contracts", description: "Topic 2", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "topic-3", name: "Ownership structure", description: "Topic 3", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

// ---------------------------------------------------------------------------
// Captured findings store — module-level so vi.mock factory closures can write to it
// ---------------------------------------------------------------------------
type InsertedFinding = {
  firmId: string;
  topicId: string;
  summary: string;
  confidence: string;
  sourceUrl: string;
  sourceTitle: string;
  rawSnippet: string;
  sourceDate?: string | null;
};

const insertedFindings: InsertedFinding[] = [];

// ---------------------------------------------------------------------------
// Mock 'ai' module — controls generateText output per test
// ---------------------------------------------------------------------------
const mockGenerateText = vi.fn();

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

// ---------------------------------------------------------------------------
// Mock @ai-sdk/anthropic so ANTHROPIC_API_KEY is not required
// ---------------------------------------------------------------------------
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => ({ provider: "anthropic-mock", modelId: "claude-sonnet-4-6" })),
}));

// ---------------------------------------------------------------------------
// Mock the DB client — separate select call handlers for firms vs topics
// The worker calls:
//   db.select().from(firms).where(...).limit(1)  -> [MOCK_FIRM]
//   db.select().from(topics)                      -> MOCK_TOPICS  (awaited directly)
//   db.insert(findings).values(row)               -> void
// ---------------------------------------------------------------------------
let dbSelectCallIndex = 0;

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => {
      const idx = dbSelectCallIndex++;
      if (idx === 0) {
        // First call: firm lookup
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([MOCK_FIRM])),
            })),
          })),
        };
      }
      // Subsequent calls: topics query — from() returns a thenable
      return {
        from: vi.fn(() => Promise.resolve(MOCK_TOPICS)),
      };
    }),
    insert: vi.fn(() => ({
      values: vi.fn((row: InsertedFinding) => {
        insertedFindings.push(row);
        return {
          onConflictDoUpdate: vi.fn(() => Promise.resolve()),
        };
      }),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/db/schema — minimal stubs for table references used in worker
// ---------------------------------------------------------------------------
vi.mock("@/db/schema", () => ({
  firms: { id: "firms.id" },
  topics: { id: "topics.id" },
  findings: { firmId: "findings.firm_id", topicId: "findings.topic_id" },
}));

// ---------------------------------------------------------------------------
// Mock drizzle-orm operators
// ---------------------------------------------------------------------------
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_field: unknown, _value: unknown) => "eq-stub"),
  desc: vi.fn((_field: unknown) => "desc-stub"),
  sql: vi.fn(() => "sql-stub"),
}));

// ---------------------------------------------------------------------------
// Mock grounding builder so no CH API calls are made
// ---------------------------------------------------------------------------
vi.mock("./grounding", () => ({
  buildGroundingContext: vi.fn(() =>
    Promise.resolve({
      firmName: "Test Firm Ltd",
      companiesHouseNumber: "12345678",
      chSummary: "Active UK company",
      procurementSummary: "No procurement records",
    })
  ),
  formatGroundingContext: vi.fn(() => "Test grounding context"),
}));

// ---------------------------------------------------------------------------
// Mock prompts
// ---------------------------------------------------------------------------
vi.mock("./prompts", () => ({
  RESEARCH_SYSTEM_PROMPT: "You are a test analyst.",
  buildSearchQuery: vi.fn((firmName: string, topic: { name: string }) => `${firmName} ${topic.name}`),
  buildTopicPrompt: vi.fn(() => "Test prompt"),
  formatSearchResults: vi.fn(() => "Test results"),
}));

// ---------------------------------------------------------------------------
// Stub WebSearchClient
// ---------------------------------------------------------------------------
const STUB_SEARCH_RESULTS: WebSearchResult[] = [
  {
    url: "https://example.com/nuclear-firm",
    title: "Test Firm Nuclear Work",
    snippet: "Test Firm Ltd has extensive nuclear decommissioning experience.",
  },
];

const stubSearchClient = {
  search: vi.fn(() => Promise.resolve(STUB_SEARCH_RESULTS)),
};

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  insertedFindings.length = 0;
  dbSelectCallIndex = 0;
  vi.clearAllMocks();
  stubSearchClient.search.mockResolvedValue(STUB_SEARCH_RESULTS);
  mockGenerateText.mockReset();
});

// ---------------------------------------------------------------------------
// Tests: FindingSchema + NOT_FOUND_SENTINEL (no worker import needed)
// ---------------------------------------------------------------------------

describe("FindingSchema — no-LOW invariant", () => {
  it("no-LOW: FindingSchema rejects LOW confidence — enum is only HIGH|MEDIUM", () => {
    const result = FindingSchema.safeParse({
      summary: "Some AI-derived finding with no source.",
      confidence: "LOW",
      sourceUrl: "https://example.com/something",
      sourceTitle: "Some Page",
      rawSnippet: "Some text",
    });

    expect(result.success).toBe(false);
  });

  it("FindingSchema accepts HIGH confidence", () => {
    const result = FindingSchema.safeParse({
      summary: "Test Firm has nuclear decommissioning experience.",
      confidence: "HIGH",
      sourceUrl: "companies-house",
      sourceTitle: "Companies House",
      rawSnippet: "Active company status: active",
    });

    expect(result.success).toBe(true);
  });

  it("FindingSchema accepts MEDIUM confidence", () => {
    const result = FindingSchema.safeParse({
      summary: "Test Firm won a £5m Sellafield contract in 2024.",
      confidence: "MEDIUM",
      sourceUrl: "https://example.com/sellafield-contracts",
      sourceTitle: "Sellafield Contracts 2024",
      rawSnippet: "Awarded in 2023.",
    });

    expect(result.success).toBe(true);
  });
});

describe("NOT_FOUND_SENTINEL", () => {
  it("returns sourceUrl=not-found and summary starting with 'Not found:'", () => {
    const sentinel = NOT_FOUND_SENTINEL("topic-xyz", "no search results");
    expect(sentinel.sourceUrl).toBe("not-found");
    expect(sentinel.summary).toMatch(/^Not found:/);
    expect(sentinel.confidence).toBe("HIGH");
    expect(sentinel.sourceTitle).toBe("Research worker");
    expect(sentinel.rawSnippet).toContain("topic-xyz");
  });
});

// ---------------------------------------------------------------------------
// Tests: runResearchWorker (imports worker after mocks are registered)
// ---------------------------------------------------------------------------

describe("runResearchWorker invariants", () => {
  it("E1 — citation completeness: valid HIGH finding writes rows with non-empty citation fields", async () => {
    const { runResearchWorker } = await import("./worker");

    mockGenerateText.mockResolvedValue({
      output: {
        summary: "Test Firm Ltd holds a nuclear decommissioning licence from ONR.",
        confidence: "HIGH",
        sourceUrl: "https://example.com/nuclear-firm",
        sourceTitle: "Test Firm Nuclear Work",
        rawSnippet: "Test Firm Ltd has extensive nuclear decommissioning experience.",
      },
    });

    await runResearchWorker("firm-abc", "job-001", stubSearchClient);

    expect(insertedFindings.length).toBeGreaterThan(0);
    for (const finding of insertedFindings) {
      expect(finding.sourceUrl.length).toBeGreaterThan(0);
      expect(finding.sourceTitle.length).toBeGreaterThan(0);
      expect(finding.rawSnippet.length).toBeGreaterThan(0);
    }
  });

  it("E2 — explicit absence: NoObjectGeneratedError produces a not-found sentinel row", async () => {
    const { runResearchWorker } = await import("./worker");
    const { NoObjectGeneratedError } = await import("ai");

    // Topic 1: succeeds
    mockGenerateText.mockResolvedValueOnce({
      output: {
        summary: "Test Firm Ltd has some nuclear work.",
        confidence: "HIGH",
        sourceUrl: "https://example.com/nuclear-firm",
        sourceTitle: "Test Firm Nuclear Work",
        rawSnippet: "Test Firm Ltd has extensive nuclear decommissioning experience.",
      },
    });
    // Topic 2: throws NoObjectGeneratedError -> sentinel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGenerateText.mockRejectedValueOnce(
      // Cast to avoid strict LanguageModelUsage type requirements in tests
      new NoObjectGeneratedError({
        message: "Model failed",
        text: "bad output",
        response: { id: "r1", timestamp: new Date(), modelId: "m1", headers: {} },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any,
        cause: undefined,
        finishReason: "stop",
      })
    );
    // Topic 3: succeeds
    mockGenerateText.mockResolvedValueOnce({
      output: {
        summary: "Test Firm Ltd has some government contracts.",
        confidence: "HIGH",
        sourceUrl: "https://example.com/contracts",
        sourceTitle: "Contract Info",
        rawSnippet: "Awarded in 2023.",
      },
    });

    await runResearchWorker("firm-abc", "job-002", stubSearchClient);

    // At least one sentinel row exists
    const sentinelRows = insertedFindings.filter((f) => f.sourceUrl === "not-found");
    expect(sentinelRows.length).toBeGreaterThan(0);
    expect(sentinelRows[0].summary).toMatch(/^Not found:/);
  });

  it("topic coverage: COUNT(DISTINCT topicId) equals number of seeded topics", async () => {
    const { runResearchWorker } = await import("./worker");

    mockGenerateText.mockResolvedValue({
      output: {
        summary: "Test Firm Ltd has some relevant capability.",
        confidence: "HIGH",
        sourceUrl: "https://example.com/nuclear-firm",
        sourceTitle: "Test Firm Nuclear Work",
        rawSnippet: "Test Firm Ltd has extensive nuclear decommissioning experience.",
      },
    });

    await runResearchWorker("firm-abc", "job-003", stubSearchClient);

    const distinctTopicIds = new Set(insertedFindings.map((f) => f.topicId));
    expect(distinctTopicIds.size).toBe(MOCK_TOPICS.length);
    expect(insertedFindings.length).toBe(MOCK_TOPICS.length);
  });
});
