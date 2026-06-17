import { describe, it, expect } from "vitest";
import { assembleConsortiumPrompt, extractJsonFromLlmText } from "../assemble-prompt";
import type { ConsortiumPromptInput } from "../types";

const BASE_INPUT: ConsortiumPromptInput = {
  opportunity: { name: "Sellafield Decommissioning", description: "Major nuclear decommissioning programme." },
  roles: [
    { id: "r1", title: "Prime contractor", description: "Holds the contract, NDA relationship required." },
    { id: "r2", title: "Technical specialist", description: "Deep decommissioning expertise." },
  ],
  anchorFirmId: null,
  constraints: { ukOwned: true, noHighRisk: false, priorNuclear: true, freeText: "" },
  firms: [
    {
      id: "a1b2c3d4-0000-0000-0000-000000000001",
      canonicalName: "Alpha Nuclear Ltd",
      capabilityTags: ["Nuclear", "Consultancy"],
      ownership: { ukIncorporated: "yes", ultimateParent: null, countryOfOwnership: "UK" },
      riskFlags: [{ flagType: "financial", severity: "Low", description: "Minor late filing" }],
      partnerships: [
        {
          partnerFirmName: "Beta Infrastructure Plc",
          partnershipType: "co-supplier",
          evidenceSummary: "Co-supplier on Hinkley C site prep",
          evidenceDate: "2022-04-01",
        },
      ],
      conflicts: [],
      findings: [
        {
          topicName: "Nuclear Experience",
          summary: "Strong track record in decommissioning",
          sourceTitle: "NDA Annual Report 2023",
          sourceUrl: "https://example.com/nda-report",
        },
      ],
    },
  ],
  include: { findings: true, riskFlags: true, partnerships: true, ownership: true },
};

describe("assembleConsortiumPrompt", () => {
  it("includes opportunity name and description", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("Sellafield Decommissioning");
    expect(prompt).toContain("Major nuclear decommissioning programme.");
  });

  it("includes all role titles and descriptions", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("Prime contractor");
    expect(prompt).toContain("Holds the contract, NDA relationship required.");
    expect(prompt).toContain("Technical specialist");
    expect(prompt).toContain("Deep decommissioning expertise.");
  });

  it("includes a ROLES section header", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("## ROLES");
  });

  it("omits CONSORTIUM STRUCTURE section when anchorFirmId is null", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).not.toContain("CONSORTIUM STRUCTURE");
    expect(prompt).not.toContain("Anchor firm:");
  });

  it("includes CONSORTIUM STRUCTURE and firm name when anchorFirmId is set", () => {
    const input: ConsortiumPromptInput = {
      ...BASE_INPUT,
      anchorFirmId: "a1b2c3d4-0000-0000-0000-000000000001",
    };
    const prompt = assembleConsortiumPrompt(input);
    expect(prompt).toContain("## CONSORTIUM STRUCTURE");
    expect(prompt).toContain("Alpha Nuclear Ltd");
    expect(prompt).toContain("MUST lead the consortium");
  });

  it("omits CONSORTIUM STRUCTURE when anchorFirmId does not match any firm", () => {
    const input: ConsortiumPromptInput = {
      ...BASE_INPUT,
      anchorFirmId: "00000000-0000-0000-0000-000000000000",
    };
    const prompt = assembleConsortiumPrompt(input);
    expect(prompt).not.toContain("CONSORTIUM STRUCTURE");
  });

  it("skips roles with empty titles", () => {
    const input: ConsortiumPromptInput = {
      ...BASE_INPUT,
      roles: [
        { id: "r1", title: "Prime contractor", description: "Holds the contract." },
        { id: "r2", title: "", description: "Ignored because title is blank" },
      ],
    };
    const prompt = assembleConsortiumPrompt(input);
    expect(prompt).toContain("Prime contractor");
    expect(prompt).not.toContain("Ignored because title is blank");
  });

  it("includes UK ownership constraint when set", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("Firms must be UK-incorporated");
  });

  it("omits noHighRisk constraint when false", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).not.toContain("Exclude firms with High-severity risk flags");
  });

  it("includes firm name and capabilities", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("Alpha Nuclear Ltd");
    expect(prompt).toContain("Nuclear, Consultancy");
  });

  it("includes ownership when include.ownership is true", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("UK incorporated: Yes");
  });

  it("omits ownership when include.ownership is false", () => {
    const prompt = assembleConsortiumPrompt({ ...BASE_INPUT, include: { ...BASE_INPUT.include, ownership: false } });
    expect(prompt).not.toContain("UK incorporated");
  });

  it("includes risk flags when include.riskFlags is true", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("Low");
    expect(prompt).toContain("Minor late filing");
  });

  it("includes partnerships when include.partnerships is true", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("Beta Infrastructure Plc");
    expect(prompt).toContain("co-supplier");
  });

  it("includes findings when include.findings is true", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("Nuclear Experience");
    expect(prompt).toContain("Strong track record in decommissioning");
  });

  it("ends with JSON format instruction", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("capability");
    expect(prompt).toContain("ukOwnership");
    expect(prompt).toContain("partnershipEvidence");
  });

  it("handles empty firms list gracefully", () => {
    const prompt = assembleConsortiumPrompt({ ...BASE_INPUT, firms: [] });
    expect(prompt).toContain("FIRM PROFILES");
    expect(prompt).toContain("TASK");
  });

  it("omits description line when description is empty", () => {
    const prompt = assembleConsortiumPrompt({
      ...BASE_INPUT,
      opportunity: { name: "Test Bid", description: "" },
    });
    expect(prompt).not.toContain("Description:");
  });

  it("task section references roles", () => {
    const prompt = assembleConsortiumPrompt(BASE_INPUT);
    expect(prompt).toContain("mapped to the roles defined above");
    expect(prompt).toContain("complement each other");
  });
});

describe("extractJsonFromLlmText", () => {
  it("extracts from markdown json fence", () => {
    const text = '```json\n[{"name":"A"}]\n```';
    expect(extractJsonFromLlmText(text)).toBe('[{"name":"A"}]');
  });

  it("extracts from plain markdown fence", () => {
    const text = '```\n[{"name":"B"}]\n```';
    expect(extractJsonFromLlmText(text)).toBe('[{"name":"B"}]');
  });

  it("extracts bare array", () => {
    const text = 'Here is the result:\n[{"name":"C"}]\nDone.';
    expect(extractJsonFromLlmText(text)).toBe('[{"name":"C"}]');
  });

  it("returns trimmed text when no array found", () => {
    const text = "  no json here  ";
    expect(extractJsonFromLlmText(text)).toBe("no json here");
  });
});
