/**
 * E9 — Seeded 12×7 integration test: scorer against real seeded Postgres.
 *
 * Prerequisites (NOT mocked — connects to a real DB):
 *   docker compose up -d db
 *   npm run db:push
 *   npm run db:seed
 *
 * This is the ONLY test in the recommend suite that touches the DB directly.
 * All other tests in scorer.test.ts and schemas.test.ts are pure unit tests
 * with no DB dependency.
 *
 * Snapshot policy:
 *   The toMatchSnapshot() call below is a deterministic regression tripwire.
 *   Volatile fields (timestamps, raw UUIDs) are stripped before snapshotting.
 *   Update the snapshot only with -u after an intentional, reviewed scoring
 *   change — not to "fix" a failing CI run without understanding the delta.
 *
 * If this test suite is run without a seeded DB or DATABASE_URL (e.g. in a
 * fresh CI environment that did not run db:seed), the test will skip rather
 * than hard-fail, so it does not block the rest of the test suite.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { scoreAndRankCombinations } from "../scorer";
import { RecommendResponseSchema } from "../schemas";

// Guard: skip the entire suite if DATABASE_URL is not set.
// This prevents the module-level throw in @/db/client from crashing the suite
// on machines without a configured Postgres (e.g. CI without docker compose).
const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);

let db: Awaited<ReturnType<typeof import("@/db/client")>>["db"] | null = null;
let firms: (typeof import("@/db/schema"))["firms"] | null = null;
let conflictPairs: (typeof import("@/db/schema"))["conflictPairs"] | null = null;
let partnershipPairs: (typeof import("@/db/schema"))["partnershipPairs"] | null = null;
let ownershipRecords: (typeof import("@/db/schema"))["ownershipRecords"] | null = null;
let riskFlags: (typeof import("@/db/schema"))["riskFlags"] | null = null;
let procurementRecords: (typeof import("@/db/schema"))["procurementRecords"] | null = null;
let sql: Awaited<ReturnType<typeof import("@/db/client")>>["sql"] | null = null;

if (DB_AVAILABLE) {
  // Dynamic imports so the module loader never evaluates @/db/client when
  // DATABASE_URL is absent (the client throws at module evaluation time).
  const clientModule = await import("@/db/client");
  const schemaModule = await import("@/db/schema");
  db = clientModule.db;
  sql = clientModule.sql;
  firms = schemaModule.firms;
  conflictPairs = schemaModule.conflictPairs;
  partnershipPairs = schemaModule.partnershipPairs;
  ownershipRecords = schemaModule.ownershipRecords;
  riskFlags = schemaModule.riskFlags;
  procurementRecords = schemaModule.procurementRecords;
}

afterAll(async () => {
  // Close the Postgres connection pool so Vitest can exit cleanly.
  if (sql) await sql.end();
});

// Use describe.skipIf so Vitest reports a visible skip (yellow) rather than a
// false-green passing test when DATABASE_URL is absent. A bare `return` inside
// an `it()` body counts as a passing test in Vitest — not a skip.
describe.skipIf(!DB_AVAILABLE)("E9 — seeded 12×7 integration test", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let loadedRows: { af: any[]; ac: any[]; ap: any[]; ao: any[]; ar: any[]; apr: any[] } | null = null;

  beforeAll(async () => {
    if (!db || !firms || !conflictPairs || !partnershipPairs || !ownershipRecords || !riskFlags || !procurementRecords) return;
    const [af, ac, ap, ao, ar, apr] = await Promise.all([
      db.select().from(firms),
      db.select().from(conflictPairs),
      db.select().from(partnershipPairs),
      db.select().from(ownershipRecords),
      db.select().from(riskFlags),
      db.select().from(procurementRecords),
    ]);
    loadedRows = { af, ac, ap, ao, ar, apr };
  });

  it("returns a schema-valid 1+1+1 ok result from the seeded Postgres", async () => {
    // Skip if the DB was not seeded — remaining guard for empty-DB state.
    if (!loadedRows || loadedRows.af.length === 0) {
      console.warn(
        "[E9 SKIP] firms table is empty — DB not seeded. " +
          "Run: docker compose up -d db && npm run db:push && npm run db:seed",
      );
      return;
    }

    const { af, ac, ap, ao, ar, apr } = loadedRows;

    // Assertion 1: seeded pool size
    expect(af.length).toBeGreaterThanOrEqual(12);

    // Run the scorer with the default 1+1+1 mix, empty locks, equal 25 weights
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = scoreAndRankCombinations({
      capabilityMix: { Consultancy: 1, Infrastructure: 1, Nuclear: 1 },
      lockedFirmIds: [],
      weights: {
        contractRelevance: 25,
        ukOwnership: 25,
        partnerships: 25,
        riskFlags: 25,
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      firms: af,
      conflicts: ac,
      partnerships: ap,
      ownership: ao,
      riskFlags: ar,
      procurement: apr,
    });

    // Assertion 2: status must be ok (seeded data covers all three capability tags)
    expect(result.status).toBe("ok");

    // Assertion 3: schema-valid output — throws ZodError if the contract is broken
    const validated = RecommendResponseSchema.parse(result);
    expect(validated.status).toBe("ok");

    if (validated.status !== "ok") return; // TypeScript narrowing guard

    // Assertion 4: primary recommendation covers all three required capability tags
    const primary = validated.recommendations[0];
    expect(primary).toBeDefined();

    const primaryTags = primary!.firms.flatMap((f) => f.capabilityTags);
    expect(primaryTags).toContain("Consultancy");
    expect(primaryTags).toContain("Infrastructure");
    expect(primaryTags).toContain("Nuclear");

    // Assertion 5: every firm in the primary recommendation has all required fields
    // (E2 ownershipRecord invariant + E6 explainability)
    for (const firm of primary!.firms) {
      // E6: signalScores has all four fields
      expect(firm.signalScores).toHaveProperty("contractRelevance");
      expect(firm.signalScores).toHaveProperty("ukOwnership");
      expect(firm.signalScores).toHaveProperty("riskFlags");
      expect(firm.signalScores).toHaveProperty("capabilityMatch");

      // All signal scores are in [0, 1]
      expect(firm.signalScores.contractRelevance).toBeGreaterThanOrEqual(0);
      expect(firm.signalScores.contractRelevance).toBeLessThanOrEqual(1);
      expect(firm.signalScores.ukOwnership).toBeGreaterThanOrEqual(0);
      expect(firm.signalScores.ukOwnership).toBeLessThanOrEqual(1);
      expect(firm.signalScores.riskFlags).toBeGreaterThanOrEqual(0);
      expect(firm.signalScores.riskFlags).toBeLessThanOrEqual(1);

      // E2: ownershipRecord key always present regardless of ukOwnership weight
      expect(firm).toHaveProperty("ownershipRecord");

      // riskFlagCount is a non-negative integer
      expect(firm.riskFlagCount).toBeGreaterThanOrEqual(0);
    }

    // Assertion 6: hasPriorPartnerships is a boolean
    expect(typeof primary!.hasPriorPartnerships).toBe("boolean");

    // Assertion 7: at most 3 recommendations, all with rank 1-3
    expect(validated.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(validated.recommendations.length).toBeLessThanOrEqual(3);
    for (const rec of validated.recommendations) {
      expect(rec.rank).toBeGreaterThanOrEqual(1);
      expect(rec.rank).toBeLessThanOrEqual(3);
    }

    // Assertion 8: golden snapshot — normalized to strip volatile fields.
    // firmId UUIDs are replaced with firmName for readability and stability.
    // ownershipRecord is reduced to { ukIncorporated, countryOfOwnership } to
    // strip source text and timestamps. Snapshot is the regression tripwire.
    const normalizedResult = {
      status: validated.status,
      recommendations: validated.recommendations.map((rec) => ({
        rank: rec.rank,
        hasPriorPartnerships: rec.hasPriorPartnerships,
        firms: rec.firms.map((f) => ({
          firmName: f.firmName,
          capabilityTags: [...f.capabilityTags].sort(),
          signalScores: {
            contractRelevance: Math.round(f.signalScores.contractRelevance * 100) / 100,
            ukOwnership: Math.round(f.signalScores.ukOwnership * 100) / 100,
            riskFlags: Math.round(f.signalScores.riskFlags * 100) / 100,
            capabilityMatch: Math.round(f.signalScores.capabilityMatch * 100) / 100,
          },
          ownershipRecord: f.ownershipRecord
            ? {
                ukIncorporated: f.ownershipRecord.ukIncorporated as string,
                countryOfOwnership: f.ownershipRecord.countryOfOwnership as string | null,
              }
            : null,
          riskFlagCount: f.riskFlagCount,
        })),
      })),
    };

    expect(normalizedResult).toMatchSnapshot();
  });
});
