import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Firm } from "@/lib/types";

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
  procurementRecords: { firmId: "firm_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  count: () => ({ op: "count" }),
  sql: Object.assign((strings: TemplateStringsArray, ...vals: unknown[]) => strings.raw.join(""), {
    raw: (s: string) => s,
  }),
}));

// Import after mocks are set up
import { getComparisonRows } from "./comparison-rows";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const FIRM_A: Firm = {
  id: "firm-1",
  canonicalName: "AtkinsRéalis",
  aliases: "[]",
  companiesHouseNumber: "01093549",
  capabilityTags: '["Nuclear","Infrastructure"]',
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: "2026-06-14",
};

const FIRM_B: Firm = {
  id: "firm-2",
  canonicalName: "Jacobs Engineering",
  aliases: "[]",
  companiesHouseNumber: "04407304",
  capabilityTags: '["Infrastructure","Consultancy"]',
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: null,
};

const FIRM_C: Firm = {
  id: "firm-3",
  canonicalName: "Framatome UK",
  aliases: "[]",
  companiesHouseNumber: null,
  capabilityTags: '["Nuclear"]',
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastResearchedAt: null,
};

// ---------------------------------------------------------------------------
// Helper: build a chainable mock for the DB query chain
// getComparisonRows selects all firms, then selects procurementRecords grouped
// by firmId to compute contract counts, and merges in JS.
// The implementation makes 2 db.select() calls:
//   call 1: all firms → .from() → Promise<Firm[]>
//   call 2: contractCounts → .from().groupBy() or similar
// ---------------------------------------------------------------------------
function buildSelectMock(
  firmsRows: Firm[],
  contractCountRows: Array<{ firmId: string; contractCount: number }>,
) {
  let call = 0;
  mockSelect.mockImplementation(() => {
    call++;
    const c = call;
    if (c === 1) {
      // firms — .from() directly awaitable
      return {
        from: () => Promise.resolve(firmsRows),
      };
    }
    // c === 2: contract counts — .from().groupBy() (no leftJoin in current implementation)
    return {
      from: () => ({
        groupBy: () => Promise.resolve(contractCountRows),
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

describe("getComparisonRows", () => {
  it("Test 1: returns one row per firm with all firm fields preserved", async () => {
    buildSelectMock(
      [FIRM_A, FIRM_B],
      [
        { firmId: "firm-1", contractCount: 3 },
        { firmId: "firm-2", contractCount: 1 },
      ],
    );

    const rows = await getComparisonRows();

    expect(rows).toHaveLength(2);

    const rowA = rows.find((r) => r.id === "firm-1");
    expect(rowA).toBeDefined();
    expect(rowA!.canonicalName).toBe("AtkinsRéalis");
    expect(rowA!.capabilityTags).toBe('["Nuclear","Infrastructure"]');
    expect(rowA!.lastResearchedAt).toBe("2026-06-14");
    expect(rowA!.companiesHouseNumber).toBe("01093549");
  });

  it("Test 2: contractCount equals the number of procurementRecords for that firm; zero when none", async () => {
    buildSelectMock(
      [FIRM_A, FIRM_B],
      [
        { firmId: "firm-1", contractCount: 5 },
        // firm-2 has no matching rows
      ],
    );

    const rows = await getComparisonRows();
    const rowA = rows.find((r) => r.id === "firm-1");
    const rowB = rows.find((r) => r.id === "firm-2");

    expect(rowA!.contractCount).toBe(5);
    expect(rowB!.contractCount).toBe(0);
  });

  it("Test 3: returns every firm even when no procurement records exist at all", async () => {
    buildSelectMock(
      [FIRM_A, FIRM_B, FIRM_C],
      [], // zero procurement records
    );

    const rows = await getComparisonRows();

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.contractCount).toBe(0);
    }
  });
});
