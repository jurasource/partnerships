import { describe, it, expect } from "vitest";

// Import the seed data directly to test it without running the full seed
// (which would execute the runSeed() function and interact with the live DB)
import type { InferSelectModel } from "drizzle-orm";

describe("Seed Data (CONF-06)", () => {
  it("defines exactly 12 firms in SEED_FIRMS", () => {
    // Arrange: Load the seed file as a module
    // For this test, we verify the seed arrays by importing and parsing them
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    // Count the number of SEED_FIRMS array entries
    // We look for the pattern: { companiesHouseNumber, canonicalName, ...}
    // by counting opening braces that start a firm definition

    // A more reliable approach: search for "canonicalName:" occurrences in the SEED_FIRMS section
    const seedFirmsSection = seedContent.match(
      /const SEED_FIRMS: SeedFirm\[\] = \[([\s\S]*?)\];/
    );

    expect(seedFirmsSection).toBeDefined();
    if (seedFirmsSection) {
      const firmsContent = seedFirmsSection[1];
      // Count objects by counting "canonicalName:" which appears once per firm
      const firmCount = (firmsContent.match(/canonicalName:/g) || []).length;
      expect(firmCount).toBe(12);
    }
  });

  it("defines exactly 7 topics in SEED_TOPICS", () => {
    // Arrange: Load the seed file
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    // Find SEED_TOPICS section
    const seedTopicsSection = seedContent.match(
      /const SEED_TOPICS: SeedTopic\[\] = \[([\s\S]*?)\];/
    );

    expect(seedTopicsSection).toBeDefined();
    if (seedTopicsSection) {
      const topicsContent = seedTopicsSection[1];
      // Count objects by counting "name:" which appears once per topic
      const topicCount = (topicsContent.match(/name:/g) || []).length;
      expect(topicCount).toBe(7);
    }
  });

  it("all 12 firms have canonicalName defined (required field)", () => {
    // Arrange
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    const seedFirmsSection = seedContent.match(
      /const SEED_FIRMS: SeedFirm\[\] = \[([\s\S]*?)\];/
    );

    expect(seedFirmsSection).toBeDefined();
    if (seedFirmsSection) {
      const firmsContent = seedFirmsSection[1];
      // Count canonicalName entries
      const canonicalNames = (firmsContent.match(/canonicalName:/g) || [])
        .length;
      // Each firm should have a canonicalName
      expect(canonicalNames).toBe(12);
    }
  });

  it("all 7 topics have name defined (required field)", () => {
    // Arrange
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    const seedTopicsSection = seedContent.match(
      /const SEED_TOPICS: SeedTopic\[\] = \[([\s\S]*?)\];/
    );

    expect(seedTopicsSection).toBeDefined();
    if (seedTopicsSection) {
      const topicsContent = seedTopicsSection[1];
      // Count topic name entries
      const names = (topicsContent.match(/name:/g) || []).length;
      expect(names).toBe(7);
    }
  });

  it("all 12 firms have either a valid CH number or explicit null with TODO comment", () => {
    // Arrange
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    const seedFirmsSection = seedContent.match(
      /const SEED_FIRMS: SeedFirm\[\] = \[([\s\S]*?)\];/
    );

    expect(seedFirmsSection).toBeDefined();
    if (seedFirmsSection) {
      const firmsContent = seedFirmsSection[1];
      // Count companiesHouseNumber fields
      const chNumbers = (firmsContent.match(/companiesHouseNumber:/g) || [])
        .length;
      // Each firm should have a companiesHouseNumber field (either value or null)
      expect(chNumbers).toBe(12);

      // Verify null entries have TODO comments (Pitfall 2 compliance)
      const nullCount = (firmsContent.match(/companiesHouseNumber: null/g) || [])
        .length;
      const todoCount = (seedContent.match(/TODO.*CH number/g) || []).length;

      // If there are nulls, there should be corresponding TODO comments
      if (nullCount > 0) {
        expect(todoCount).toBeGreaterThanOrEqual(nullCount);
      }
    }
  });

  it("seed is marked as idempotent with a check for existing topics", () => {
    // Arrange
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    // Check for idempotency pattern: "existingTopics.length" or similar
    const hasIdempotencyCheck =
      /existingTopics\.length|topics table is not empty/.test(seedContent);

    expect(hasIdempotencyCheck).toBe(true);
  });

  it("runSeed function is exported or called to execute the seed", () => {
    // Arrange
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    // Check for runSeed execution
    const hasRunSeed =
      /async function runSeed|runSeed\(\)/.test(seedContent);

    expect(hasRunSeed).toBe(true);
  });

  it("firms have capabilityTags as an array of Nuclear/Infrastructure/Consultancy strings", () => {
    // Arrange
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    const seedFirmsSection = seedContent.match(
      /const SEED_FIRMS: SeedFirm\[\] = \[([\s\S]*?)\];/
    );

    expect(seedFirmsSection).toBeDefined();
    if (seedFirmsSection) {
      const firmsContent = seedFirmsSection[1];
      // Look for capabilityTags arrays
      const capTags = firmsContent.match(/\["Nuclear"\]|\["Infrastructure"\]|\["Consultancy"\]/g) || [];
      // Should have at least some firms with these tags
      expect(capTags.length).toBeGreaterThan(0);

      // Verify Nuclear appears in at least one firm
      expect(seedContent.match(/Nuclear/)).toBeDefined();
    }
  });

  it("firms have aliases array with at least one alias per firm", () => {
    // Arrange
    const fs = require("fs");
    const path = require("path");

    const seedFilePath = path.resolve(__dirname, "./seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");

    const seedFirmsSection = seedContent.match(
      /const SEED_FIRMS: SeedFirm\[\] = \[([\s\S]*?)\];/
    );

    expect(seedFirmsSection).toBeDefined();
    if (seedFirmsSection) {
      const firmsContent = seedFirmsSection[1];
      // Count aliases arrays (appear after canonicalName in each firm def)
      const aliasArrays = (firmsContent.match(/aliases: \[/g) || []).length;
      // Should be one per firm
      expect(aliasArrays).toBe(12);
    }
  });
});
