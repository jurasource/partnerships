import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Firm,
  Topic,
  Finding,
  ProcurementRecord,
  OwnershipRecord,
  RiskFlag,
  CollaborationRecord,
  ConflictPair,
  PartnershipPair,
  JvLead,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Hoist mocks before any module imports that depend on them
// ---------------------------------------------------------------------------
const { mockSelect } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  return { mockSelect };
});

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
  ownershipRecords: { firmId: "firm_id" },
  riskFlags: { firmId: "firm_id" },
  collaborationRecords: { firmId: "firm_id" },
  conflictPairs: { firmAId: "firm_a_id", firmBId: "firm_b_id" },
  partnershipPairs: { firmAId: "firm_a_id", firmBId: "firm_b_id" },
  jvLeads: { sourceFirmId: "source_firm_id" },
  chSnapshots: { firmId: "firm_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  desc: (col: unknown) => ({ col, op: "desc" }),
  or: (...conditions: unknown[]) => ({ conditions, op: "or" }),
}));

// Import after mocks are set up
import { getFirmProfile } from "./firm-profile";

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
  searchTerms: "",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const TOPIC_B: Topic = {
  id: "topic-b",
  name: "Ownership structure",
  description: "Corporate ownership",
  searchTerms: "",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const TOPIC_C: Topic = {
  id: "topic-c",
  name: "Past contracts",
  description: "Past UK contracts",
  searchTerms: "",
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
  sourceDate: "2024-03-15",
  citations: "[]",
  searchResults: null,
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
  sourceDate: null,
  citations: "[]",
  searchResults: null,
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
  sourceDate: null,
  citations: "[]",
  searchResults: null,
  createdAt: "2026-06-14",
};

const FINDING_RESEARCH_ERROR: Finding = {
  id: "finding-4",
  firmId: "firm-1",
  topicId: "topic-c",
  summary: "Research error: Model failed to produce structured output after retries.",
  sourceUrl: "research-error",
  sourceTitle: "Research worker",
  rawSnippet: "Research failed for topic topic-c.",
  confidence: "HIGH",
  sourceDate: null,
  citations: "[]",
  searchResults: null,
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
// Helper: build a chainable mock for a single DB call sequence
// getFirmProfile makes 1 initial select (firm row) + 10 parallel selects:
//   call 1:  firms → .from().where().limit()
//   call 2:  topics → .from() directly awaitable
//   call 3:  findings → .from().where().orderBy()
//   call 4:  procurementRecords → .from().where().orderBy()
//   call 5:  ownershipRecords → .from().where().limit()
//   call 6:  riskFlags → .from().where()
//   call 7:  collaborationRecords → .from().where().limit()
//   call 8:  conflictPairs → .from().where()
//   call 9:  partnershipPairs → .from().where()
//   call 10: jvLeads → .from().where()
//   call 11: chSnapshots → .from().where().limit()
// ---------------------------------------------------------------------------
function buildSelectMock(
  firmRow: Firm | null,
  topicsRows: Topic[],
  findingsRows: Finding[],
  contractsRows: ProcurementRecord[],
  ownershipRows: OwnershipRecord[] = [],
  riskFlagRows: RiskFlag[] = [],
  collaborationRows: CollaborationRecord[] = [],
  conflictRows: ConflictPair[] = [],
  partnershipRows: PartnershipPair[] = [],
  jvLeadRows: JvLead[] = [],
) {
  let call = 0;
  mockSelect.mockImplementation(() => {
    call++;
    const c = call;
    if (c === 1) {
      // firms — .from().where().limit()
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(firmRow ? [firmRow] : []),
          }),
        }),
      };
    }
    if (c === 2) {
      // topics — .from() is directly awaitable (then-able)
      return {
        from: () => {
          const p = Promise.resolve(topicsRows);
          return p;
        },
      };
    }
    if (c === 3) {
      // findings — .from().where().orderBy()
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(findingsRows),
          }),
        }),
      };
    }
    if (c === 4) {
      // procurementRecords — .from().where().orderBy()
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(contractsRows),
          }),
        }),
      };
    }
    if (c === 5) {
      // ownershipRecords — .from().where().limit()
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(ownershipRows),
          }),
        }),
      };
    }
    if (c === 6) {
      // riskFlags — .from().where()
      return {
        from: () => ({
          where: () => Promise.resolve(riskFlagRows),
        }),
      };
    }
    if (c === 7) {
      // collaborationRecords — .from().where().limit()
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(collaborationRows),
          }),
        }),
      };
    }
    if (c === 8) {
      // conflictPairs — .from().where()
      return {
        from: () => ({
          where: () => Promise.resolve(conflictRows),
        }),
      };
    }
    if (c === 9) {
      // partnershipPairs — .from().where()
      return {
        from: () => ({
          where: () => Promise.resolve(partnershipRows),
        }),
      };
    }
    if (c === 10) {
      // jvLeads — .from().where()
      return {
        from: () => ({
          where: () => Promise.resolve(jvLeadRows),
        }),
      };
    }
    // c === 11: chSnapshots — .from().where().limit()
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
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
    buildSelectMock(null, [], [], []);
    const result = await getFirmProfile("nonexistent-id");
    expect(result).toBeNull();
  });

  it("Test 2: returns firm plus findingsByTopic with one entry per topic, null for missing findings", async () => {
    // Only FINDING_MEDIUM (topic-a) — topics B and C have no finding
    buildSelectMock(FIRM, [TOPIC_A, TOPIC_B, TOPIC_C], [FINDING_MEDIUM], [CONTRACT_A, CONTRACT_B]);

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();
    expect(result!.firm.id).toBe("firm-1");

    // One entry per topic (3 topics total)
    expect(result!.findingsByTopic).toHaveLength(3);

    // Topic A has a finding
    const topicAEntry = result!.findingsByTopic.find(e => e.topic.id === "topic-a");
    expect(topicAEntry?.finding).not.toBeNull();

    // Topic B and C have no finding (null)
    const topicBEntry = result!.findingsByTopic.find(e => e.topic.id === "topic-b");
    expect(topicBEntry?.finding).toBeNull();

    const topicCEntry = result!.findingsByTopic.find(e => e.topic.id === "topic-c");
    expect(topicCEntry?.finding).toBeNull();
  });

  it("Test 3: sourceType — MEDIUM→ai, HIGH+not-sentinel→structured, not-found-sentinel→structured+isNotFound:true", async () => {
    buildSelectMock(
      FIRM,
      [TOPIC_A, TOPIC_B, TOPIC_C],
      [FINDING_MEDIUM, FINDING_HIGH, FINDING_NOT_FOUND],
      [],
    );

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();

    const topicA = result!.findingsByTopic.find(e => e.topic.id === "topic-a");
    expect(topicA?.sourceType).toBe("ai"); // MEDIUM → ai
    expect(topicA?.isNotFound).toBe(false);
    expect(topicA?.isError).toBe(false);

    const topicB = result!.findingsByTopic.find(e => e.topic.id === "topic-b");
    expect(topicB?.sourceType).toBe("structured"); // HIGH, real URL → structured
    expect(topicB?.isNotFound).toBe(false);
    expect(topicB?.isError).toBe(false);

    const topicC = result!.findingsByTopic.find(e => e.topic.id === "topic-c");
    expect(topicC?.sourceType).toBe("structured"); // not-found sentinel → structured
    expect(topicC?.isNotFound).toBe(true); // sourceUrl === "not-found"
    expect(topicC?.isError).toBe(false);
  });

  it("Test 3b: research-error sentinel → sourceType:structured, isError:true, isNotFound:false", async () => {
    buildSelectMock(
      FIRM,
      [TOPIC_A, TOPIC_B, TOPIC_C],
      [FINDING_MEDIUM, FINDING_HIGH, FINDING_RESEARCH_ERROR],
      [],
    );

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();

    const topicC = result!.findingsByTopic.find(e => e.topic.id === "topic-c");
    expect(topicC?.sourceType).toBe("structured"); // error sentinel → structured
    expect(topicC?.isError).toBe(true);
    expect(topicC?.isNotFound).toBe(false);
  });

  it("Test 4: contracts array is ordered by awardDate descending and carries required fields", async () => {
    // DB returns in desc order — most recent first
    const orderedContracts = [CONTRACT_A, CONTRACT_B]; // A is 2025-04-10, B is 2024-02-01
    buildSelectMock(FIRM, [TOPIC_A], [], orderedContracts);

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();
    expect(result!.contracts).toHaveLength(2);

    // First contract: most recent award date
    expect(result!.contracts[0].ocid).toBe("ocds-001");
    expect(result!.contracts[0].awardDate).toBe("2025-04-10");
    expect(result!.contracts[0].title).toBe("Sellafield support");
    expect(result!.contracts[0].value).toBe("1500000");
    expect(result!.contracts[0].sourceApi).toBe("contracts_finder");

    // Second contract: older
    expect(result!.contracts[1].ocid).toBe("ocds-002");
    expect(result!.contracts[1].awardDate).toBe("2024-02-01");
  });

  it("Test 5: returns cross-cutting fields — ownership, riskFlags, collaboration, conflicts, partnerships", async () => {
    const ownership: OwnershipRecord = {
      id: "own-1",
      firmId: "firm-1",
      ukIncorporated: "yes",
      ultimateParent: null,
      countryOfOwnership: "UK",
      pscNotTraceable: "no",
      sourceType: "companies_house",
      sourceUrl: "https://companies-house.gov.uk/company/01093549",
      sourceTitle: "Companies House PSC",
      rawSnippet: "PSC data",
      createdAt: "2026-06-15",
    };

    buildSelectMock(
      FIRM,
      [TOPIC_A],
      [],
      [],
      [ownership],
      [], // no risk flags
      [], // no collaboration
      [], // no conflicts
      [], // no partnerships
    );

    const result = await getFirmProfile("firm-1");
    expect(result).not.toBeNull();
    expect(result!.ownership).not.toBeNull();
    expect(result!.ownership!.ukIncorporated).toBe("yes");
    expect(result!.ownership!.countryOfOwnership).toBe("UK");
    expect(result!.riskFlags).toHaveLength(0);
    expect(result!.collaboration).toBeNull();
    expect(result!.conflicts).toHaveLength(0);
    expect(result!.partnerships).toHaveLength(0);
    expect(result!.jvLeads).toHaveLength(0);
  });
});
