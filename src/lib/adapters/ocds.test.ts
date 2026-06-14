import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  normaliseOcdsRelease,
  matchFirmToSupplier,
  upsertProcurementRecords,
  type OcdsRelease,
} from "./ocds";
import type { Firm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock the DB client so the adapter's upsert path is testable without SQLite.
// We capture rows passed to insert().values() and emulate onConflict-by-ocid.
// ---------------------------------------------------------------------------
type CapturedRow = { ocid: string; sourceApi: string; firmId: string };
const store = new Map<string, CapturedRow>();

vi.mock("@/db/client", () => {
  return {
    db: {
      insert: () => ({
        values: (row: CapturedRow) => ({
          // emulate onConflictDoNothing keyed on ocid
          onConflictDoNothing: () => {
            if (!store.has(row.ocid)) store.set(row.ocid, row);
          },
          onConflictDoUpdate: () => {
            store.set(row.ocid, row);
          },
        }),
      }),
    },
  };
});

vi.mock("@/db/schema", () => ({
  procurementRecords: { ocid: "ocid" },
}));

// ---------------------------------------------------------------------------
// Fixtures — small inline OCDS 1.1.5 releases.
// The SAME ocid arrives from both Contracts Finder and Find a Tender.
// ---------------------------------------------------------------------------
const FIRM: Firm = {
  id: "firm-1",
  canonicalName: "AtkinsRéalis",
  aliases: JSON.stringify(["SNC-Lavalin", "Atkins"]),
  companiesHouseNumber: "01093549",
  capabilityTags: JSON.stringify(["Nuclear", "Infrastructure"]),
  createdAt: "2026-06-14",
  updatedAt: "2026-06-14",
};

function releaseFromCF(): OcdsRelease {
  return {
    ocid: "ocds-b5fd17-shared-notice-001",
    date: "2025-03-01T00:00:00Z",
    tender: { title: "Sellafield decommissioning support" },
    buyer: { name: "Sellafield Ltd" },
    awards: [
      {
        date: "2025-04-10T00:00:00Z",
        value: { amount: 1500000, currency: "GBP" },
        suppliers: [
          {
            name: "Atkins Limited",
            identifier: { scheme: "GB-COH", id: "01093549" },
          },
        ],
      },
    ],
  };
}

function releaseFromFTS(): OcdsRelease {
  // Same ocid, different source — must dedupe to one row.
  return {
    ocid: "ocds-b5fd17-shared-notice-001",
    date: "2025-03-01T00:00:00Z",
    tender: { title: "Sellafield decommissioning support" },
    buyer: { name: "Sellafield Ltd" },
    awards: [
      {
        date: "2025-04-10T00:00:00Z",
        value: { amount: 1500000, currency: "GBP" },
        suppliers: [
          {
            name: "Atkins Limited",
            identifier: { scheme: "GB-COH", id: "01093549" },
          },
        ],
      },
    ],
  };
}

function releaseEmptySupplier(): OcdsRelease {
  return {
    ocid: "ocds-b5fd17-empty-supplier-002",
    date: "2025-01-01T00:00:00Z",
    tender: { title: "Framework with no named supplier" },
    buyer: { name: "Some Authority" },
    awards: [
      {
        date: undefined,
        value: undefined,
        suppliers: [{ name: "", identifier: undefined }],
      },
    ],
  };
}

function releaseOtherFirm(): OcdsRelease {
  return {
    ocid: "ocds-b5fd17-other-003",
    date: "2025-02-01T00:00:00Z",
    tender: { title: "Unrelated award" },
    buyer: { name: "Other Authority" },
    awards: [
      {
        date: "2025-02-15T00:00:00Z",
        value: { amount: 500, currency: "GBP" },
        suppliers: [
          { name: "Totally Different Co", identifier: { scheme: "GB-COH", id: "99999999" } },
        ],
      },
    ],
  };
}

beforeEach(() => {
  store.clear();
});

describe("normaliseOcdsRelease", () => {
  it("maps OCDS fields into a NormalisedNotice", () => {
    const n = normaliseOcdsRelease(releaseFromCF(), "contracts_finder");
    expect(n.ocid).toBe("ocds-b5fd17-shared-notice-001");
    expect(n.title).toBe("Sellafield decommissioning support");
    expect(n.contractingAuthority).toBe("Sellafield Ltd");
    expect(n.supplierChNumber).toBe("01093549");
    expect(n.awardDate).toBe("2025-04-10T00:00:00Z");
    expect(n.value).toBe("1500000");
    expect(n.sourceApi).toBe("contracts_finder");
  });

  it("tolerates an empty supplier name and missing dates/value without throwing", () => {
    const n = normaliseOcdsRelease(releaseEmptySupplier(), "find_a_tender");
    expect(n.ocid).toBe("ocds-b5fd17-empty-supplier-002");
    expect(n.supplierChNumber).toBeNull();
    expect(n.awardDate).toBeNull();
    expect(n.value).toBeNull();
  });
});

describe("matchFirmToSupplier", () => {
  it("matches by Companies House number (DATA-04)", () => {
    expect(matchFirmToSupplier(FIRM, releaseFromCF())).toBe(true);
  });

  it("does not match an unrelated firm's CH number", () => {
    expect(matchFirmToSupplier(FIRM, releaseOtherFirm())).toBe(false);
  });
});

describe("upsertProcurementRecords (dedup by ocid, D-09/DATA-05)", () => {
  it("writes exactly ONE row when the same ocid arrives from both sources", async () => {
    await upsertProcurementRecords(FIRM, [releaseFromCF()], "contracts_finder");
    await upsertProcurementRecords(FIRM, [releaseFromFTS()], "find_a_tender");
    expect(store.size).toBe(1);
    expect(store.has("ocds-b5fd17-shared-notice-001")).toBe(true);
  });

  it("only writes firm-matched releases (CH-number match)", async () => {
    await upsertProcurementRecords(FIRM, [releaseFromCF(), releaseOtherFirm()], "contracts_finder");
    expect(store.size).toBe(1);
    expect(store.has("ocds-b5fd17-other-003")).toBe(false);
  });
});
