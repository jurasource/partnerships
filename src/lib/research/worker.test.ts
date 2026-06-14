/**
 * Research worker invariant tests (E1/E2/no-LOW/topic-coverage).
 *
 * These tests MUST run without TAVILY_API_KEY or ANTHROPIC_API_KEY set.
 * The worker is tested via dependency-injection (stub WebSearchClient) and
 * vi.mock('ai') to control generateText output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebSearchResult } from "@/lib/search/types";
import { NOT_FOUND_SENTINEL, FindingSchema } from "./schemas";

// ---------------------------------------------------------------------------
// Mock 'ai' module — controls generateText output per test
// ---------------------------------------------------------------------------
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
    Output: actual.Output,
    NoObjectGeneratedError: actual.NoObjectGeneratedError,
  };
});

// Mock @ai-sdk/anthropic so ANTHROPIC_API_KEY is not required
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => ({ provider: "anthropic-mock", modelId: "claude-sonnet-4-6" })),
}));

// ---------------------------------------------------------------------------
// Mock the DB client — capture rows inserted into findings
// ---------------------------------------------------------------------------
type InsertedFinding = {
  firmId: string;
  topicId: string;
  summary: string;
  confidence: string;
  sourceUrl: string;
  sourceTitle: string;
  rawSnippet: string;
};

const insertedFindings: InsertedFinding[] = [];

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([MOCK_FIRM])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((row: InsertedFinding) => {
        insertedFindings.push(row);
        return Promise.resolve();
      }),
    })),
  },
}));

// Mock firms + topics schema references
const MOCK_TOPICS = [
  { id: "topic-1", name: "UK nuclear capability", description: "Test topic 1", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "topic-2", name: "Past government contracts", description: "Test topic 2", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "topic-3", name: "Ownership structure", description: "Test topic 3", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

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

vi.mock("@/db/schema", async () => {
  const actual = await vi.importActual<typeof import("@/db/schema")>("@/db/schema");
  return {
    ...actual,
  };
});

// Mock the DB .select().from(topics) chain to return MOCK_TOPICS
// We need to intercept the topics query specifically
vi.mock("@/db/client", () => {
  let callCount = 0;
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          // First call is firm lookup, subsequent calls are topics lookup
          // Detect by checking if we're being chained with .where() or not
          const result = {
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([MOCK_FIRM])),
            })),
            // For topics: direct resolution without .where()
            then: undefined as unknown,
          };
          // Make it thenable (so await db.select().from(topics) works)
          Object.defineProperty(result, Symbol.iterator, {
            get: () => MOCK_TOPICS[Symbol.iterator].bind(MOCK_TOPICS),
          });
          // Return a promise-like that resolves to topics when awaited directly
          const promise = Promise.resolve(MOCK_TOPICS) as Promise<typeof MOCK_TOPICS> & typeof result;
          Object.assign(promise, result);
          return promise;
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((row: InsertedFinding) => {
          insertedFindings.push(row);
          return Promise.resolve();
        }),
      })),
    },
  };
});

// Mock grounding and prompts so they don't need CH API
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

vi.mock("./prompts", () => ({
  RESEARCH_SYSTEM_PROMPT: "You are a test analyst.",
  buildSearchQuery: vi.fn((firmName: string, topic: { name: string }) => `${firmName} ${topic.name}`),
  buildTopicPrompt: vi.fn(() => "Test prompt"),
  formatSearchResults: vi.fn(() => "Test results"),
}));

// ---------------------------------------------------------------------------
// Stub WebSearchClient — returns fixed search results
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
// Import the module under test AFTER mocks are set up
// ---------------------------------------------------------------------------
import { generateText } from "ai";
const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runResearchWorker invariants", () => {
  beforeEach(() => {
    insertedFindings.length = 0;
    vi.clearAllMocks();
    stubSearchClient.search.mockResolvedValue(STUB_SEARCH_RESULTS);
  });

  it("E1 — citation completeness: valid HIGH finding has non-empty sourceUrl, sourceTitle, rawSnippet", async () => {
    const { runResearchWorker } = await import("./worker");

    // Arrange: generateText returns a valid HIGH finding
    mockGenerateText.mockResolvedValue({
      output: {
        summary: "Test Firm Ltd holds a nuclear decommissioning licence from ONR.",
        confidence: "HIGH",
        sourceUrl: "https://example.com/nuclear-firm",
        sourceTitle: "Test Firm Nuclear Work",
        rawSnippet: "Test Firm Ltd has extensive nuclear decommissioning experience.",
      },
    });

    // Act
    await runResearchWorker("firm-abc", "job-001", stubSearchClient);

    // Assert: every inserted finding has non-empty citation fields
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

    // Arrange: first call succeeds, second throws NoObjectGeneratedError
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          summary: "Test Firm Ltd has some nuclear work.",
          confidence: "HIGH",
          sourceUrl: "https://example.com/nuclear-firm",
          sourceTitle: "Test Firm Nuclear Work",
          rawSnippet: "Test Firm Ltd has extensive nuclear decommissioning experience.",
        },
      })
      .mockRejectedValue(
        new NoObjectGeneratedError({
          message: "Model failed to produce structured output",
          text: "raw model output",
          response: { id: "test", timestamp: new Date(), modelId: "claude-sonnet-4-6", headers: {}, body: {} },
          usage: { promptTokens: 100, completionTokens: 0, totalTokens: 100 },
          cause: undefined,
          finishReason: "stop",
        })
      );

    // Act
    await runResearchWorker("firm-abc", "job-002", stubSearchClient);

    // Assert: at least one sentinel row exists (sourceUrl === 'not-found')
    const sentinelRows = insertedFindings.filter((f) => f.sourceUrl === "not-found");
    expect(sentinelRows.length).toBeGreaterThan(0);
    expect(sentinelRows[0].summary).toMatch(/^Not found:/);
  });

  it("no-LOW: FindingSchema rejects LOW confidence — enum is only HIGH|MEDIUM", () => {
    // Assert: attempting to parse a LOW finding fails schema validation
    const result = FindingSchema.safeParse({
      summary: "Some AI-derived finding with no source.",
      confidence: "LOW",
      sourceUrl: "https://example.com/something",
      sourceTitle: "Some Page",
      rawSnippet: "Some text",
    });

    expect(result.success).toBe(false);
  });

  it("topic coverage: COUNT(DISTINCT topicId) equals number of seeded topics", async () => {
    const { runResearchWorker } = await import("./worker");

    // Arrange: all calls succeed with valid findings
    mockGenerateText.mockResolvedValue({
      output: {
        summary: "Test Firm Ltd has some relevant capability.",
        confidence: "HIGH",
        sourceUrl: "https://example.com/nuclear-firm",
        sourceTitle: "Test Firm Nuclear Work",
        rawSnippet: "Test Firm Ltd has extensive nuclear decommissioning experience.",
      },
    });

    // Act
    await runResearchWorker("firm-abc", "job-003", stubSearchClient);

    // Assert: one row per topic (MOCK_TOPICS has 3 entries for this test)
    const distinctTopicIds = new Set(insertedFindings.map((f) => f.topicId));
    expect(distinctTopicIds.size).toBe(MOCK_TOPICS.length);
  });
});
