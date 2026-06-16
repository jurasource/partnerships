import type { ConsortiumPromptInput } from "./types";

export function assembleConsortiumPrompt(input: ConsortiumPromptInput): string {
  const { opportunity, capabilityMix, constraints, firms, include } = input;

  const lines: string[] = [];

  lines.push(
    "You are a UK public procurement consortium planning expert specialising in civil nuclear and defence programmes.",
    "",
    "## OPPORTUNITY",
    `Name: ${opportunity.name}`,
  );
  if (opportunity.description.trim()) {
    lines.push(`Description: ${opportunity.description.trim()}`);
  }

  lines.push("", "## REQUIREMENTS");

  const mixParts: string[] = [];
  if (capabilityMix.Nuclear > 0) mixParts.push(`${capabilityMix.Nuclear} Nuclear`);
  if (capabilityMix.Infrastructure > 0) mixParts.push(`${capabilityMix.Infrastructure} Infrastructure`);
  if (capabilityMix.Consultancy > 0) mixParts.push(`${capabilityMix.Consultancy} Consultancy`);
  if (mixParts.length > 0) {
    lines.push(`Capability mix: ${mixParts.join(", ")}`);
  }

  const constraintList: string[] = [];
  if (constraints.ukOwned) constraintList.push("Firms must be UK-incorporated");
  if (constraints.noHighRisk) constraintList.push("Exclude firms with High-severity risk flags");
  if (constraints.priorNuclear) constraintList.push("Firms must have prior nuclear contract history");
  if (constraints.freeText.trim()) constraintList.push(constraints.freeText.trim());
  if (constraintList.length > 0) {
    lines.push("Additional constraints:");
    for (const c of constraintList) lines.push(`  - ${c}`);
  }

  lines.push("", "## FIRM PROFILES");

  for (const firm of firms) {
    lines.push("", `### ${firm.canonicalName}`);
    lines.push(`Capabilities: ${firm.capabilityTags.length > 0 ? firm.capabilityTags.join(", ") : "Not specified"}`);

    if (include.ownership) {
      if (firm.ownership) {
        const { ukIncorporated, ultimateParent, countryOfOwnership } = firm.ownership;
        const ukLabel = ukIncorporated === "yes" ? "Yes" : ukIncorporated === "no" ? "No" : "Unknown";
        const parentPart = ultimateParent ? `, ultimate parent: ${ultimateParent}` : "";
        const countryPart = countryOfOwnership ? ` (${countryOfOwnership})` : "";
        lines.push(`Ownership: UK incorporated: ${ukLabel}${parentPart}${countryPart}`);
      } else {
        lines.push("Ownership: No data");
      }
    }

    if (include.riskFlags) {
      if (firm.riskFlags.length > 0) {
        lines.push("Risk flags:");
        for (const flag of firm.riskFlags) {
          lines.push(`  - [${flag.severity}] ${flag.flagType}: ${flag.description}`);
        }
      } else {
        lines.push("Risk flags: None");
      }
    }

    if (include.partnerships) {
      if (firm.partnerships.length > 0) {
        lines.push("Known partnerships:");
        for (const p of firm.partnerships) {
          const date = p.evidenceDate ? ` (${p.evidenceDate})` : "";
          lines.push(`  - ${p.partnershipType} with ${p.partnerFirmName}${date}: ${p.evidenceSummary}`);
        }
      } else {
        lines.push("Known partnerships: None on record");
      }
      if (firm.conflicts.length > 0) {
        lines.push("Known conflicts:");
        for (const c of firm.conflicts) {
          lines.push(`  - ${c.conflictType} conflict with ${c.otherFirmName}: ${c.evidenceSummary}`);
        }
      }
    }

    if (include.findings && firm.findings.length > 0) {
      lines.push("Research findings:");
      for (const f of firm.findings) {
        lines.push(`  [${f.topicName}] ${f.summary} (Source: ${f.sourceTitle})`);
      }
    }
  }

  lines.push(
    "",
    "## TASK",
    "Based on the firm profiles above, suggest 3 optimal consortium configurations.",
    "For each consortium:",
    "1. Give it a descriptive name",
    "2. List member firms with their specific roles",
    "3. Explain the strategic rationale",
    "4. Identify key risks and red flags",
    "5. Score on four dimensions (0.0–1.0): capability coverage, UK ownership compliance, risk profile, prior partnership evidence",
    "",
    "Return ONLY a JSON array with no markdown wrapping, no explanation. Each element must match this structure exactly:",
    '[{"name":"string","firms":[{"name":"string","role":"string"}],"rationale":"string","risks":"string","scores":{"capability":0.0,"ukOwnership":0.0,"riskProfile":0.0,"partnershipEvidence":0.0}}]',
  );

  return lines.join("\n");
}

export function extractJsonFromLlmText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}
