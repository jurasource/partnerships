/**
 * Unit tests for detectCoSuppliers (ANAL-02).
 *
 * Tests must run without a live DB or Redis connection.
 * All DB interactions are mocked via vi.mock().
 *
 * Key behaviours under test:
 * - Two firms sharing an ocid produces one canonical partnership pair
 * - Canonical ordering: firmAId < firmBId lexicographically
 * - Idempotent: calling twice does not produce duplicate rows (onConflictDoUpdate)
 * - Firm with no shared ocids produces no pairs
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIRM_A = "firm-aardvark"; // "firm-aardvark" < "firm-zebra"
const FIRM_B = "firm-zebra";

// Two procurement_records rows sharing the same ocid, one per firm
const SHARED_OCID = "ocds-ocid-shared-001";

const PROC_RECORD_FIRM_A = {
  id: "pr-1",
  firmId: FIRM_A,
  ocid: SHARED_OCID,
  sourceApi: "contracts_finder",
  title: "Nuclear Decommissioning Contract 2024",
  noticeDate: "2024-01-01",
  value: "1000000",
  supplierChNumber: "12345678",
  awardDate: "2024-03-01",
  contractingAuthority: "NDA",
  rawJson: "{}",
  createdAt: "2026-01-01",
};

const PROC_RECORD_FIRM_B = {
  id: "pr-2",
  firmId: FIRM_B,
  ocid: SHARED_OCID,
  sourceApi: "contracts_finder",
  title: "Nuclear Decommissioning Contract 2024",
  noticeDate: "2024-01-01",
  value: "1000000",
  supplierChNumber: "87654321",
  awardDate: "2024-03-01",
  contractingAuthority: "NDA",
  rawJson: "{}",
  createdAt: "2026-01-01",
};

// ---------------------------------------------------------------------------
// Captured DB inserts
// ---------------------------------------------------------------------------

type InsertedRow = Record<string, unknown>;
let capturedInserts: InsertedRow[] = [];
let capturedUpsertCalls = 0;

// ---------------------------------------------------------------------------
// Mock @/db/client
//
// We need the mock to support two different select() call patterns:
// 1. Select ocids for the target firmId (returns PROC_RECORD_FIRM_A)
// 2. Select all records with those ocids (returns both records)
// ---------------------------------------------------------------------------

let selectCallCount = 0;

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // First call: get ocids for the target firm
            return Promise.resolve([PROC_RECORD_FIRM_A]);
          }
          // Second call: get all records for those ocids
          return Promise.resolve([PROC_RECORD_FIRM_A, PROC_RECORD_FIRM_B]);
        }),
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
  procurementRecords: {
    firmId: "procurement_records.firm_id",
    ocid: "procurement_records.ocid",
    title: "procurement_records.title",
    awardDate: "procurement_records.award_date",
  },
  partnershipPairs: {
    firmAId: "partnership_pairs.firm_a_id",
    firmBId: "partnership_pairs.firm_b_id",
    partnershipType: "partnership_pairs.partnership_type",
    sourceUrl: "partnership_pairs.source_url",
    sourceTitle: "partnership_pairs.source_title",
    evidenceSummary: "partnership_pairs.evidence_summary",
    evidenceDate: "partnership_pairs.evidence_date",
    sourceType: "partnership_pairs.source_type",
  },
}));

// ---------------------------------------------------------------------------
// Mock drizzle-orm
// ---------------------------------------------------------------------------

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => "eq-stub"),
  inArray: vi.fn((_col: unknown, _vals: unknown) => "inArray-stub"),
  and: vi.fn((..._args: unknown[]) => "and-stub"),
}));

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedInserts = [];
  capturedUpsertCalls = 0;
  selectCallCount = 0;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("detectCoSuppliers — shared ocid detection", () => {
  it("produces one canonical partnership pair when two firms share an ocid", async () => {
    const { detectCoSuppliers } = await import("../co-supplier");
    await detectCoSuppliers(FIRM_A);

    expect(capturedInserts.length).toBe(1);
    const row = capturedInserts[0];
    expect(row.partnershipType).toBe("co-supplier");
    expect(row.sourceType).toBe("ocds");
    expect(row.sourceUrl).toBe(SHARED_OCID);
  });

  it("stores the pair with canonical ordering (firmAId < firmBId lexicographically)", async () => {
    const { detectCoSuppliers } = await import("../co-supplier");
    await detectCoSuppliers(FIRM_A);

    expect(capturedInserts.length).toBe(1);
    const row = capturedInserts[0];
    // FIRM_A = "firm-aardvark" < FIRM_B = "firm-zebra"
    expect(row.firmAId).toBe(FIRM_A);
    expect(row.firmBId).toBe(FIRM_B);
  });

  it("uses onConflictDoUpdate for idempotency on re-run", async () => {
    const { detectCoSuppliers } = await import("../co-supplier");
    await detectCoSuppliers(FIRM_A);

    // onConflictDoUpdate must be called (not plain insert)
    expect(capturedUpsertCalls).toBeGreaterThan(0);
  });

  it("does not produce pairs when the target firm has no shared ocids", async () => {
    // Override select to return empty for both queries
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    dbMock.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])), // no records at all
      })),
    });

    const { detectCoSuppliers } = await import("../co-supplier");
    await detectCoSuppliers(FIRM_A);

    expect(capturedInserts.length).toBe(0);
  });
});

describe("detectCoSuppliers — canonical ordering", () => {
  it("produces canonical ordering regardless of which firm triggers detection (B runs the job)", async () => {
    // When FIRM_B (firm-zebra) runs the job, result should still be firmAId=FIRM_A, firmBId=FIRM_B
    selectCallCount = 0;
    // On first select call, return PROC_RECORD_FIRM_B; second call returns both
    const { db } = await import("@/db/client");
    const dbMock = db as { select: ReturnType<typeof vi.fn> };
    let callCount = 0;
    dbMock.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([PROC_RECORD_FIRM_B]);
          }
          return Promise.resolve([PROC_RECORD_FIRM_A, PROC_RECORD_FIRM_B]);
        }),
      })),
    });

    const { detectCoSuppliers } = await import("../co-supplier");
    await detectCoSuppliers(FIRM_B);

    expect(capturedInserts.length).toBe(1);
    const row = capturedInserts[0];
    // Canonical: firmAId < firmBId
    expect(row.firmAId).toBe(FIRM_A);
    expect(row.firmBId).toBe(FIRM_B);
  });
});
