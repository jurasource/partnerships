/**
 * Unit tests for extractOwnership (PROF-04/ANAL-03).
 *
 * Tests must run without COMPANIES_HOUSE_API_KEY or ANTHROPIC_API_KEY.
 * All external dependencies are mocked via vi.mock() + vi.hoisted().
 *
 * Key behaviours under test:
 * - UK firm (PSC jurisdiction UK) → ownership_records row with ukIncorporated "yes"
 * - Foreign corporate PSC with no UK registration → countryOfOwnership = foreign ISO, pscNotTraceable "yes"
 * - No CH number and no finding → writes "unknown" row (never throws, never absent)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_UK_FIRM = {
  id: "firm-uk",
  canonicalName: "UK Nuclear Ltd",
  aliases: "[]",
  companiesHouseNumber: "12345678",
  capabilityTags: "[]",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: null,
};

const MOCK_FOREIGN_FIRM = {
  id: "firm-foreign",
  canonicalName: "Foreign Corp SA",
  aliases: "[]",
  companiesHouseNumber: "87654321",
  capabilityTags: "[]",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: null,
};

const MOCK_NO_CH_FIRM = {
  id: "firm-noch",
  canonicalName: "No CH Firm",
  aliases: "[]",
  companiesHouseNumber: null,
  capabilityTags: "[]",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: null,
};

// CH profile for UK firm
const UK_CH_PROFILE = {
  company_number: "12345678",
  company_name: "UK Nuclear Ltd",
  company_status: "active",
  jurisdiction: "england-wales",
};

// CH PSC for UK firm — one UK natural person PSC
const UK_PSC_RECORD = {
  active_count: 1,
  items: [
    {
      name: "Jane Smith",
      kind: "individual-person-with-significant-control",
      nationality: "British",
      country_of_residence: "England",
      natures_of_control: ["ownership-of-shares-75-to-100-percent"],
    },
  ],
};

// CH profile for foreign firm
const FOREIGN_CH_PROFILE = {
  company_number: "87654321",
  company_name: "Foreign Corp SA",
  company_status: "active",
  jurisdiction: "england-wales",
};

// CH PSC for foreign firm — one foreign corporate PSC
const FOREIGN_PSC_RECORD = {
  active_count: 1,
  items: [
    {
      name: "Foreign Parent SA",
      kind: "corporate-entity-person-with-significant-control",
      country_of_residence: "France",
      natures_of_control: ["ownership-of-shares-75-to-100-percent"],
    },
  ],
};

// ---------------------------------------------------------------------------
// Captured DB writes — module-level so factory closures write to them
// ---------------------------------------------------------------------------

type InsertedOwnershipRow = Record<string, unknown>;
let capturedOwnershipInserts: InsertedOwnershipRow[] = [];
let capturedUpsertCalls: number = 0;

// Control which firm to return from the select mock
let firmToReturn: typeof MOCK_UK_FIRM | typeof MOCK_FOREIGN_FIRM | typeof MOCK_NO_CH_FIRM =
  MOCK_UK_FIRM;

// ---------------------------------------------------------------------------
// Mock @/db/client
// ---------------------------------------------------------------------------

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([firmToReturn])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((row: InsertedOwnershipRow) => {
        capturedOwnershipInserts.push({ ...row });
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
// Mock @/db/schema — provide table objects with column references
// ---------------------------------------------------------------------------

vi.mock("@/db/schema", () => ({
  firms: {
    id: "firms.id",
    canonicalName: "firms.canonical_name",
    companiesHouseNumber: "firms.companies_house_number",
  },
  ownershipRecords: {
    firmId: "ownership_records.firm_id",
    ukIncorporated: "ownership_records.uk_incorporated",
    ultimateParent: "ownership_records.ultimate_parent",
    countryOfOwnership: "ownership_records.country_of_ownership",
    pscNotTraceable: "ownership_records.psc_not_traceable",
    sourceType: "ownership_records.source_type",
    sourceUrl: "ownership_records.source_url",
    sourceTitle: "ownership_records.source_title",
    rawSnippet: "ownership_records.raw_snippet",
  },
  findings: {
    firmId: "findings.firm_id",
    topicId: "findings.topic_id",
  },
  topics: {
    id: "topics.id",
    name: "topics.name",
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
// Mock Companies House client
// ---------------------------------------------------------------------------

const mockGetCompanyProfile = vi.fn();
const mockGetPSC = vi.fn();

vi.mock("@/lib/clients/companies-house", () => ({
  getCompanyProfile: mockGetCompanyProfile,
  getPSC: mockGetPSC,
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
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedOwnershipInserts = [];
  capturedUpsertCalls = 0;
  firmToReturn = MOCK_UK_FIRM; // default
  vi.clearAllMocks();
  mockFindFindingByTopicName.mockResolvedValue(null); // default: no finding
  mockGetCompanyProfile.mockResolvedValue(null);
  mockGetPSC.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractOwnership — UK firm", () => {
  it("writes ukIncorporated 'yes' and sourceType 'companies_house' when PSC is UK natural person", async () => {
    firmToReturn = MOCK_UK_FIRM;
    mockGetCompanyProfile.mockResolvedValue(UK_CH_PROFILE);
    mockGetPSC.mockResolvedValue(UK_PSC_RECORD);

    const { extractOwnership } = await import("../ownership");
    await extractOwnership("firm-uk");

    expect(capturedOwnershipInserts.length).toBe(1);
    const row = capturedOwnershipInserts[0];
    expect(row.firmId).toBe("firm-uk");
    expect(row.ukIncorporated).toBe("yes");
    expect(row.sourceType).toBe("companies_house");
    expect(row.pscNotTraceable).toBe("no");
    expect(String(row.sourceUrl)).toContain("12345678");
  });

  it("calls onConflictDoUpdate (upsert, not plain insert)", async () => {
    firmToReturn = MOCK_UK_FIRM;
    mockGetCompanyProfile.mockResolvedValue(UK_CH_PROFILE);
    mockGetPSC.mockResolvedValue(UK_PSC_RECORD);

    const { extractOwnership } = await import("../ownership");
    await extractOwnership("firm-uk");

    expect(capturedUpsertCalls).toBeGreaterThan(0);
  });
});

describe("extractOwnership — foreign corporate PSC", () => {
  it("writes pscNotTraceable 'yes' and ukIncorporated 'no' for foreign corporate PSC", async () => {
    firmToReturn = MOCK_FOREIGN_FIRM;
    mockGetCompanyProfile.mockResolvedValue(FOREIGN_CH_PROFILE);
    mockGetPSC.mockResolvedValue(FOREIGN_PSC_RECORD);

    const { extractOwnership } = await import("../ownership");
    await extractOwnership("firm-foreign");

    expect(capturedOwnershipInserts.length).toBe(1);
    const row = capturedOwnershipInserts[0];
    expect(row.ukIncorporated).toBe("no");
    expect(row.pscNotTraceable).toBe("yes");
    // Country of ownership should be derived from foreign PSC, not "UK"
    expect(row.countryOfOwnership).not.toBe("UK");
    expect(row.countryOfOwnership).not.toBeNull();
  });
});

describe("extractOwnership — no CH number and no finding", () => {
  it("writes a row with ukIncorporated 'unknown' when no CH data and no finding exist", async () => {
    firmToReturn = MOCK_NO_CH_FIRM;
    // No CH profile fetched (no CH number)
    // No finding from topic lookup
    mockFindFindingByTopicName.mockResolvedValue(null);

    const { extractOwnership } = await import("../ownership");
    await extractOwnership("firm-noch");

    expect(capturedOwnershipInserts.length).toBe(1);
    const row = capturedOwnershipInserts[0];
    expect(row.ukIncorporated).toBe("unknown");
    expect(row.sourceType).toBe("ai_research");
    // Must still write a row — never silent (explicit empty-state pattern)
    expect(row.firmId).toBe("firm-noch");
  });

  it("does not throw when both CH data and finding are absent", async () => {
    firmToReturn = MOCK_NO_CH_FIRM;
    mockFindFindingByTopicName.mockResolvedValue(null);

    const { extractOwnership } = await import("../ownership");
    await expect(extractOwnership("firm-noch")).resolves.toBeUndefined();
  });
});

describe("extractOwnership — fallback to finding when CH unavailable", () => {
  it("uses 'ai_research' sourceType when CH API returns null but finding exists", async () => {
    firmToReturn = MOCK_UK_FIRM;
    mockGetCompanyProfile.mockResolvedValue(null); // CH unavailable
    mockGetPSC.mockResolvedValue(null);
    mockFindFindingByTopicName.mockResolvedValue({
      id: "finding-1",
      firmId: "firm-uk",
      topicId: "topic-3",
      summary: "UK Nuclear Ltd is UK-incorporated with UK owners.",
      sourceUrl: "https://example.com/ownership",
      sourceTitle: "Ownership Report",
      rawSnippet: "Wholly owned by UK residents.",
      sourceDate: "2024-01-01",
      confidence: "MEDIUM" as const,
      createdAt: "2026-01-01",
    });

    const { extractOwnership } = await import("../ownership");
    await extractOwnership("firm-uk");

    expect(capturedOwnershipInserts.length).toBe(1);
    const row = capturedOwnershipInserts[0];
    expect(row.sourceType).toBe("ai_research");
    expect(row.sourceUrl).toBe("https://example.com/ownership");
  });
});
