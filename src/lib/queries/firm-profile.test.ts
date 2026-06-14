import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFirmProfile } from "./firm-profile";
import type { Firm, Topic, Finding, ProcurementRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const FIRM: Firm = {
  id: "firm-1",
  canonicalName: "AtkinsRéalis",
  aliases: "[]",
  companiesHouseNumber: "01093549",
  capabilityTags: '["Nuclear","Infrastructure"]',
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: "2026-06-14",
};

const TOPIC_A: Topic = {
  id: "topic-a",
  name: "Nuclear capability",
  description: "Nuclear-related work",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const TOPIC_B: Topic = {
  id: "topic-b",
  name: "Ownership structure",
  description: "Corporate ownership",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const TOPIC_C: Topic = {
  id: "topic-c",
  name: "Past contracts",
  description: "Past UK contracts",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const FINDING_MEDIUM: Finding = {
  id: "finding-1",
  firmId: "firm-1",
  topicId: "topic-a",
  summary: "AtkinsRéalis has significant nuclear decommissioning capability.",
  sourceUrl: "https://example.com/nuclear",
  sourceTitle: "Atkins Nuclear",
  rawSnippet: "Atkins nuclear excerpt",
  confidence: "MEDIUM",
  createdAt: "2026-06-14",
};

const FINDING_HIGH: Finding = {
  id: "finding-2",
  firmId: "firm-1",
  topicId: "topic-b",
  summary: "Ownership structure via CH data.",
  sourceUrl: "https://companies-house.gov.uk/company/01093549",
  sourceTitle: "Companies House Profile",
  rawSnippet: "CH data snippet",
  confidence: "HIGH",
  createdAt: "2026-06-14",
};

const FINDING_NOT_FOUND: Finding = {
  id: "finding-3",
  firmId: "firm-1",
  topicId: "topic-c",
  summary: "Not found: No verified UK contracts found for this firm.",
  sourceUrl: "not-found",
  sourceTitle: "Research worker",
  rawSnippet: "No verifiable source found",
  confidence: "HIGH",
  createdAt: "2026-06-14",
};

const CONTRACT_A: ProcurementRecord = {
  id: "contract-1",
  firmId: "firm-1",
  ocid: "ocds-001",
  sourceApi: "contracts_finder",
  title: "Sellafield support",
  noticeDate: "2025-03-01",
  value: "1500000",
  supplierChNumber: "01093549",
  awardDate: "2025-04-10",
  contractingAuthority: "Sellafield Ltd",
  rawJson: "{}",
  createdAt: "2026-01-01",
};

const CONTRACT_B: ProcurementRecord = {
  id: "contract-2",
  firmId: "firm-1",
  ocid: "ocds-002",
  sourceApi: "find_a_tender",
  title: "Nuclear framework",
  noticeDate: "2024-01-01",
  value: "500000",
  supplierChNumber: "01093549",
  awardDate: "2024-02-01",
  contractingAuthority: "NDA",
  rawJson: "{}",
  createdAt: "2026-01-01",
};

// ---------------------------------------------------------------------------
// Mock the DB client
// ---------------------------------------------------------------------------
type SelectMock = {
  from: ReturnType<typeof vi.fn>;
};

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock("@/db/schema", () => ({
  firms: { id: "id" },
  topics: {},
  findings: { firmId: "firm_id" },
  procurementRecords: { firmId: "firm_id", awardDate: "award_date" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  desc: (col: unknown) => ({ col, op: "desc" }),
}));

// ---------------------------------------------------------------------------
// Helper to set up the sequential DB call chain
// ---------------------------------------------------------------------------
function setupDbMock(
  firmRow: Firm | null,
  topicsRows: Topic[],
  findingsRows: Finding[],
  contractsRows: ProcurementRecord[],
) {
  let callCount = 0;

  mockSelect.mockImplementation(() => ({
    from: (table: unknown) => {
      callCount++;
      const n = callCount;
      return {
        where: (cond: unknown) => ({
          limit: () => (n === 1 ? (firmRow ? [firmRow] : []) : []),
          orderBy: () => (n === 4 ? contractsRows : []),
        }),
        // topics — no where clause
        then: (resolve: (rows: Topic[]) => void) => resolve(topicsRows),
        // For direct awaits (topics query — no where/limit/orderBy chain)
        [Symbol.toStringTag]: "Promise",
      };
    },
  }));

  // Reset and set up a more controlled mock
  callCount = 0;
  mockSelect.mockReset();

  let invocation = 0;
  mockSelect.mockImplementation(() => {
    invocation++;
    const current = invocation;
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(current === 1 ? (firmRow ? [firmRow] : []) : []),
          orderBy: () => Promise.resolve(current === 4 ? contractsRows : []),
        }),
        // topics — awaitable directly
        then: (resolve: (value: Topic[]) => void, reject?: (reason: unknown) => void) => {
          if (current === 2) {
            return Promise.resolve(topicsRows).then(resolve, reject);
          }
          return Promise.resolve([]).then(resolve, reject);
        },
        // findings
        orderBy: () => Promise.resolve(findingsRows),
      }),
    };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getFirmProfile", () => {
  it("Test 1: returns null when no firm row matches the id", async () => {
    // Set up db.select() to return empty arrays for all queries
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      const c = call;
      if (c === 1) {
        // firms query
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
            orderBy: () => Promise.resolve([]),
          }),
          orderBy: () => Promise.resolve([]),
        }),
      };
    });

    const result = await getFirmProfile("nonexistent-id");
    expect(result).toBeNull();
  });

  it("Test 2: returns firm plus findingsByTopic with one entry per topic, null for missing findings", async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      const c = call;
      return {
        from: () => {
          if (c === 1) {
            // firms
            return {
              where: () => ({
                limit: () => Promise.resolve([FIRM]),
              }),
            };
          }
          if (c === 2) {
            // topics — no where clause, returns all topics
            return Promise.resolve([TOPIC_A, TOPIC_B, TOPIC_C]);
          }
          if (c === 3) {
            // findings
            return {
              where: () => ({
                orderBy: () => Promise.resolve([FINDING_MEDIUM]),
              }),
            };
          }
          if (c === 4) {
            // procurement records
            return {
              where: () => ({
                orderBy: () => Promise.resolve([CONTRACT_A, CONTRACT_B]),
              }),
            };
          }
          return Promise.resolve([]);
        },
      };
    });

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();
    expect(result!.firm.id).toBe("firm-1");
    // One entry per topic (3 topics total)
    expect(result!.findingsByTopic).toHaveLength(3);
    // Topic A has a finding
    const topicAEntry = result!.findingsByTopic.find(e => e.topic.id === "topic-a");
    expect(topicAEntry?.finding).not.toBeNull();
    // Topic B and C have no finding
    const topicBEntry = result!.findingsByTopic.find(e => e.topic.id === "topic-b");
    expect(topicBEntry?.finding).toBeNull();
    const topicCEntry = result!.findingsByTopic.find(e => e.topic.id === "topic-c");
    expect(topicCEntry?.finding).toBeNull();
  });

  it("Test 3: sourceType is correct — MEDIUM→ai, HIGH+not-sentinel→structured, not-found→sourceType:structured+isNotFound:true", async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      const c = call;
      return {
        from: () => {
          if (c === 1) {
            return {
              where: () => ({
                limit: () => Promise.resolve([FIRM]),
              }),
            };
          }
          if (c === 2) {
            return Promise.resolve([TOPIC_A, TOPIC_B, TOPIC_C]);
          }
          if (c === 3) {
            return {
              where: () => ({
                orderBy: () => Promise.resolve([FINDING_MEDIUM, FINDING_HIGH, FINDING_NOT_FOUND]),
              }),
            };
          }
          if (c === 4) {
            return {
              where: () => ({
                orderBy: () => Promise.resolve([]),
              }),
            };
          }
          return Promise.resolve([]);
        },
      };
    });

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();

    const topicA = result!.findingsByTopic.find(e => e.topic.id === "topic-a");
    expect(topicA?.sourceType).toBe("ai"); // MEDIUM → ai
    expect(topicA?.isNotFound).toBe(false);

    const topicB = result!.findingsByTopic.find(e => e.topic.id === "topic-b");
    expect(topicB?.sourceType).toBe("structured"); // HIGH, not sentinel → structured
    expect(topicB?.isNotFound).toBe(false);

    const topicC = result!.findingsByTopic.find(e => e.topic.id === "topic-c");
    expect(topicC?.sourceType).toBe("structured"); // not-found sentinel
    expect(topicC?.isNotFound).toBe(true); // sourceUrl === "not-found"
  });

  it("Test 4: contracts array is ordered by awardDate descending and carries required fields", async () => {
    // CONTRACT_A has awardDate 2025-04-10, CONTRACT_B has 2024-02-01
    // Ordered desc → CONTRACT_A first
    const orderedContracts = [CONTRACT_A, CONTRACT_B];

    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      const c = call;
      return {
        from: () => {
          if (c === 1) {
            return {
              where: () => ({
                limit: () => Promise.resolve([FIRM]),
              }),
            };
          }
          if (c === 2) {
            return Promise.resolve([TOPIC_A]);
          }
          if (c === 3) {
            return {
              where: () => ({
                orderBy: () => Promise.resolve([]),
              }),
            };
          }
          if (c === 4) {
            return {
              where: () => ({
                orderBy: () => Promise.resolve(orderedContracts),
              }),
            };
          }
          return Promise.resolve([]);
        },
      };
    });

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();
    expect(result!.contracts).toHaveLength(2);
    // First contract is the most recent award date
    expect(result!.contracts[0].ocid).toBe("ocds-001");
    expect(result!.contracts[0].awardDate).toBe("2025-04-10");
    expect(result!.contracts[0].title).toBe("Sellafield support");
    expect(result!.contracts[0].value).toBe("1500000");
    expect(result!.contracts[0].sourceApi).toBe("contracts_finder");
    // Second is older
    expect(result!.contracts[1].ocid).toBe("ocds-002");
  });
});
