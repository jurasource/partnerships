/**
 * Job-lifecycle integrity test (E9 — F12 fixture from AI-SPEC §5).
 *
 * Asserts:
 * 1. (Partial failure) When the worker throws mid-run after 3 topics:
 *    - The job ends in status "failed" with a non-empty errorMessage (never stuck "running").
 *    - Exactly 3 findings rows are retained (partial findings not rolled back, D-05).
 * 2. (Happy path) When the worker succeeds:
 *    - The job ends in status "done".
 *    - firms.lastResearchedAt is set to a non-null value (RES-07).
 *
 * These tests MUST run without ANTHROPIC_API_KEY or TAVILY_API_KEY set.
 * All AI, search, and Next.js calls are mocked. DB uses an in-memory SQLite
 * instance with tables created via raw SQL (no migration files required).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Uses the SQLite test fixture schema — not the production pg schema —
// so these tests can run against an in-memory SQLite instance.
import * as schema from "@/db/_test-schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Mock 'ai' so no ANTHROPIC_API_KEY is needed.
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
  anthropic: vi.fn(() => ({
    provider: "anthropic-mock",
    modelId: "claude-sonnet-4-6",
  })),
}));

// ---------------------------------------------------------------------------
// Mock Tavily client so no TAVILY_API_KEY is needed.
// ---------------------------------------------------------------------------
const mockSearch = vi.fn();

vi.mock("@/lib/search/tavily", () => ({
  tavilyClient: {
    search: mockSearch,
  },
}));

// ---------------------------------------------------------------------------
// Mock next/cache (revalidatePath is not available in Node test env)
// ---------------------------------------------------------------------------
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock next/server with real-ish NextRequest/NextResponse shims.
// We only need JSON response and status code in tests.
// ---------------------------------------------------------------------------
vi.mock("next/server", () => {
  class NextResponse extends Response {
    static json(data: unknown, init?: ResponseInit) {
      const body = JSON.stringify(data);
      return new NextResponse(body, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
    }
  }
  class NextRequest extends Request {}
  return { NextRequest, NextResponse };
});

// ---------------------------------------------------------------------------
// Mock grounding so no CH API calls are made in integration tests.
// grounding.ts uses the real DB (procurement records) and CH API — both
// irrelevant to the job-lifecycle invariants under test here.
// ---------------------------------------------------------------------------
vi.mock("@/lib/research/grounding", () => ({
  buildGroundingContext: vi.fn().mockResolvedValue({
    firmName: "Test Firm Ltd",
    companiesHouseNumber: "12345678",
    chSummary: "Active UK company",
    procurementSummary: "No procurement records",
  }),
  formatGroundingContext: vi.fn(() => "Test grounding context"),
}));

// ---------------------------------------------------------------------------
// Mock prompts (stable — not under test here)
// ---------------------------------------------------------------------------
vi.mock("@/lib/research/prompts", () => ({
  RESEARCH_SYSTEM_PROMPT: "You are a test analyst.",
  buildSearchQuery: vi.fn(
    (firmName: string, topic: { name: string }) => `${firmName} ${topic.name}`,
  ),
  buildTopicPrompt: vi.fn(() => "Test prompt"),
  formatSearchResults: vi.fn(() => "Test results"),
}));

// ---------------------------------------------------------------------------
// SQL to create all tables in SQLite (matches schema.ts exactly)
// ---------------------------------------------------------------------------
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  canonical_name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  companies_house_number TEXT,
  capability_tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_researched_at TEXT
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS procurement_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  firm_id TEXT NOT NULL REFERENCES firms(id),
  ocid TEXT NOT NULL,
  source_api TEXT NOT NULL,
  title TEXT,
  notice_date TEXT,
  value TEXT,
  supplier_ch_number TEXT,
  award_date TEXT,
  contracting_authority TEXT,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT procurement_records_ocid_unique UNIQUE (ocid)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  firm_id TEXT NOT NULL REFERENCES firms(id),
  topic_id TEXT REFERENCES topics(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  progress_message TEXT
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  firm_id TEXT NOT NULL REFERENCES firms(id),
  topic_id TEXT NOT NULL REFERENCES topics(id),
  summary TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  raw_snippet TEXT NOT NULL,
  source_date TEXT,
  confidence TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT findings_firm_topic_unique UNIQUE (firm_id, topic_id)
);
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeValidFinding(url = "https://example.com/result") {
  return {
    summary: "Test finding: this firm has nuclear decommissioning capability.",
    confidence: "HIGH" as const,
    sourceUrl: url,
    sourceTitle: "Source Title",
    rawSnippet: "Verbatim excerpt from the source.",
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("POST /api/research/run — job lifecycle integrity (E9)", () => {
  let sqlite: InstanceType<typeof Database>;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;
  let firmId: string;
  let topicIds: string[];

  beforeEach(async () => {
    // Reset all module-level mock state
    vi.resetModules();

    // Fresh in-memory SQLite for each test
    sqlite = new Database(":memory:");
    sqlite.exec(CREATE_TABLES_SQL);
    testDb = drizzle(sqlite, { schema });

    // Inject in-memory DB into all modules that import @/db/client.
    // vi.doMock (not vi.mock) runs per-call after vi.resetModules().
    vi.doMock("@/db/client", () => ({ db: testDb }));

    // Also mock @/db/schema so the worker uses the SQLite test schema tables
    // (not the pg tables from the production schema, which are incompatible with
    // the SQLite driver used here).
    vi.doMock("@/db/schema", () => schema);

    // Seed: one firm with a CH number
    const [firm] = await testDb
      .insert(schema.firms)
      .values({
        canonicalName: "Test Firm Ltd",
        companiesHouseNumber: "12345678",
        aliases: "[]",
        capabilityTags: "[]",
      })
      .returning({ id: schema.firms.id });
    firmId = firm.id;

    // Seed 7 topics (matching prod seed count)
    const topicRows = await testDb
      .insert(schema.topics)
      .values([
        { name: "UK nuclear capability", description: "Topic 1" },
        { name: "Past government contracts", description: "Topic 2" },
        { name: "Ownership structure", description: "Topic 3" },
        { name: "Key personnel", description: "Topic 4" },
        { name: "Reputational risk", description: "Topic 5" },
        { name: "Financial health", description: "Topic 6" },
        { name: "Strategic direction", description: "Topic 7" },
      ])
      .returning({ id: schema.topics.id });
    topicIds = topicRows.map((r) => r.id);

    // Default: search returns one stub result
    mockSearch.mockResolvedValue([
      {
        url: "https://example.com/result",
        title: "Example Result",
        snippet: "Verbatim excerpt from the source.",
      },
    ]);

    mockGenerateText.mockReset();
  });

  afterEach(() => {
    sqlite.close();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // E9 partial-failure: mid-run error → job "failed", 3 findings retained
  // -------------------------------------------------------------------------
  it("E9 partial failure: job ends failed with errorMessage; 3 findings retained", async () => {
    // First 3 topics succeed; 4th throws a fatal non-schema error
    // (simulates network/rate-limit failure — not NoObjectGeneratedError, so it propagates)
    let callCount = 0;
    mockGenerateText.mockImplementation(() => {
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve({ output: makeValidFinding() });
      }
      return Promise.reject(new Error("Provider rate-limit: 429 Too Many Requests"));
    });

    // Enqueue a job using testDb directly
    const [jobRow] = await testDb
      .insert(schema.jobs)
      .values({ firmId, status: "pending" })
      .returning({ id: schema.jobs.id });
    const jobId = jobRow.id;

    // Dynamic import after vi.doMock + vi.resetModules to pick up testDb
    const { POST } = await import("./route");

    const req = new Request("http://localhost:3000/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmId, jobId }),
    });

    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    // 1. Job must be in terminal state "failed" — never stuck "running" (E9, FM5)
    const [job] = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, jobId))
      .limit(1);

    expect(job.status).toBe("failed");
    expect(job.errorMessage).toBeTruthy();
    expect(job.errorMessage!.length).toBeGreaterThan(0);
    expect(job.status).not.toBe("running");

    // 2. Exactly 3 findings retained — partial-failure does NOT roll back (D-05)
    const retained = await testDb
      .select()
      .from(schema.findings)
      .where(eq(schema.findings.firmId, firmId));

    expect(retained.length).toBe(3);

    // Each retained finding must pass citation completeness (E1)
    for (const finding of retained) {
      expect(finding.sourceUrl.length).toBeGreaterThan(0);
      expect(finding.sourceTitle.length).toBeGreaterThan(0);
      expect(finding.rawSnippet.length).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // E9 happy path: job ends done, lastResearchedAt is set
  // -------------------------------------------------------------------------
  it("E9 happy path: job ends done and firms.lastResearchedAt is non-null", async () => {
    // All 7 topics succeed
    mockGenerateText.mockResolvedValue({ output: makeValidFinding() });

    const [jobRow] = await testDb
      .insert(schema.jobs)
      .values({ firmId, status: "pending" })
      .returning({ id: schema.jobs.id });
    const jobId = jobRow.id;

    const { POST } = await import("./route");

    const req = new Request("http://localhost:3000/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmId, jobId }),
    });

    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    // Job must be "done"
    const [job] = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, jobId))
      .limit(1);

    expect(job.status).toBe("done");
    expect(job.status).not.toBe("running");
    expect(job.status).not.toBe("failed");

    // firms.lastResearchedAt must be set (RES-07, D-07)
    const [firm] = await testDb
      .select()
      .from(schema.firms)
      .where(eq(schema.firms.id, firmId))
      .limit(1);

    expect(firm.lastResearchedAt).not.toBeNull();
    expect(firm.lastResearchedAt!.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // E9 guard: malformed body returns 400
  // -------------------------------------------------------------------------
  it("E9 guard: malformed body returns 400", async () => {
    const { POST } = await import("./route");

    const req = new Request("http://localhost:3000/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bad: "body" }),
    });

    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });
});
