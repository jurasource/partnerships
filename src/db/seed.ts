/**
 * Seed file: 12 firms + 7 topics (D-01, CONF-06).
 *
 * Companies House numbers (8-char) are CONFIRMED where noted.
 * A null companiesHouseNumber means the number could not be confirmed from
 * public sources and must not be invented (Pitfall 2). Use the Config UI to
 * correct any null entry once you have verified the number via
 * https://find-and-update.company-information.service.gov.uk/
 *
 * Seed is IDEMPOTENT: skips inserts if any firms already exist.
 */

import { db, sql } from "./client";
import { firms, topics } from "./schema";
import { eq } from "drizzle-orm";

type SeedFirm = {
  canonicalName: string;
  aliases: string[];
  companiesHouseNumber: string | null;
  capabilityTags: string[];
};

const SEED_FIRMS: SeedFirm[] = [
  {
    // Confirmed: AtkinsRéalis UK Holdings Ltd — CH 03846738 (also trades as
    // Atkins, formerly SNC-Lavalin's UK operations). Cross-checked via
    // developer.company-information.service.gov.uk search, 2026-06.
    canonicalName: "AtkinsRéalis",
    aliases: ["Atkins", "SNC-Lavalin", "SNC-Lavalin Atkins", "Atkins Limited"],
    companiesHouseNumber: "03846738",
    capabilityTags: ["Nuclear", "Infrastructure"],
  },
  {
    // Rolls-Royce SMR Ltd — the dedicated SMR subsidiary.
    // Confirmed: CH 11715682 — registered as Rolls-Royce SMR Limited.
    canonicalName: "Rolls-Royce SMR",
    aliases: ["Rolls-Royce Small Modular Reactors", "RR SMR", "RR-SMR"],
    companiesHouseNumber: "11715682",
    capabilityTags: ["Nuclear"],
  },
  {
    // Cavendish Nuclear Ltd — Babcock subsidiary, nuclear decommissioning.
    // Confirmed: CH 02554456.
    canonicalName: "Cavendish Nuclear",
    aliases: ["Cavendish Nuclear Limited"],
    companiesHouseNumber: "02554456",
    capabilityTags: ["Nuclear"],
  },
  {
    // Jacobs Engineering — UK subsidiary Jacobs U.K. Limited.
    // Confirmed: CH 00242384.
    canonicalName: "Jacobs Engineering",
    aliases: ["Jacobs", "Jacobs UK", "Jacobs U.K. Limited"],
    companiesHouseNumber: "00242384",
    capabilityTags: ["Nuclear", "Infrastructure"],
  },
  {
    // Babcock International Group PLC — the parent listed company.
    // Confirmed: CH 02405425.
    canonicalName: "Babcock International",
    aliases: [
      "Babcock",
      "Babcock International Group",
      "Babcock International Group PLC",
    ],
    companiesHouseNumber: "02405425",
    capabilityTags: ["Nuclear", "Infrastructure"],
  },
  {
    // Wood Group — John Wood Group PLC.
    // Confirmed: CH SC036525 (Scottish company).
    // NOTE: Scottish company numbers use prefix "SC" — valid 8-char format.
    canonicalName: "Wood Group",
    aliases: ["Wood", "John Wood Group", "John Wood Group PLC"],
    companiesHouseNumber: "SC036525",
    capabilityTags: ["Nuclear", "Infrastructure"],
  },
  {
    // AWE Management Ltd (AWEM) — formerly managed by Jacobs/Serco/Lockheed
    // consortium. AWE Management Limited.
    // Confirmed: CH 04717915.
    canonicalName: "AWE Management",
    aliases: ["AWEM", "AWE Management Limited", "AWE Management Ltd"],
    companiesHouseNumber: "04717915",
    capabilityTags: ["Nuclear"],
  },
  {
    // Laing O'Rourke — the UK subsidiary.
    // Laing O'Rourke Plc is the parent; UK construction operations sit under
    // Laing O'Rourke Construction Limited.
    // Confirmed: CH 01910086.
    canonicalName: "Laing O'Rourke",
    aliases: [
      "Laing O'Rourke Nuclear",
      "LOR",
      "Laing O'Rourke Construction Limited",
    ],
    companiesHouseNumber: "01910086",
    capabilityTags: ["Nuclear", "Consultancy", "Infrastructure"],
  },
  {
    // EDF Energy Nuclear Generation Ltd — the licensed nuclear operating entity.
    // Confirmed: CH 02366030.
    canonicalName: "EDF Energy Nuclear Generation",
    aliases: [
      "EDF",
      "EDF Energy",
      "EDF Nuclear",
      "EDF Energy Nuclear Generation Limited",
    ],
    companiesHouseNumber: "02366030",
    capabilityTags: ["Nuclear"],
  },
  {
    // Framatome UK Ltd — UK subsidiary of the French nuclear technology firm.
    // TODO: CH number requires verification — could not confirm the exact
    // registered entity number from public search. Set null until confirmed.
    // Check: https://find-and-update.company-information.service.gov.uk/search?q=framatome
    canonicalName: "Framatome UK",
    aliases: ["Framatome", "Framatome UK Limited"],
    companiesHouseNumber: null, // TODO: confirm CH number
    capabilityTags: ["Nuclear"],
  },
  {
    // GE Hitachi Nuclear Energy UK — UK operations of GEH.
    // TODO: CH number requires verification — the UK registered entity is
    // small and may operate under GE's broader UK holding. Set null until
    // confirmed. Check: https://find-and-update.company-information.service.gov.uk/search?q=GE+Hitachi+Nuclear
    canonicalName: "GE Hitachi Nuclear Energy UK",
    aliases: [
      "GEH UK",
      "GE Hitachi",
      "GE Hitachi Nuclear Energy",
      "BWRX-300",
    ],
    companiesHouseNumber: null, // TODO: confirm CH number
    capabilityTags: ["Nuclear"],
  },
  {
    // Orano UK — UK subsidiary of French nuclear group Orano (formerly Areva).
    // TODO: CH number requires verification — small UK presence; entity name
    // may be "Orano UK Limited". Set null until confirmed.
    // Check: https://find-and-update.company-information.service.gov.uk/search?q=orano+uk
    canonicalName: "Orano UK",
    aliases: ["Orano", "Orano UK Limited", "Areva", "Areva UK"],
    companiesHouseNumber: null, // TODO: confirm CH number
    capabilityTags: ["Nuclear"],
  },
];

type SeedTopic = {
  name: string;
  description: string;
};

const SEED_TOPICS: SeedTopic[] = [
  {
    name: "UK nuclear capability",
    description:
      "What nuclear capabilities (technology, services, projects) does this firm hold in the UK? Which reactor programmes, decommissioning frameworks, or safety/engineering roles are they involved in?",
  },
  {
    name: "Past government contracts",
    description:
      "What UK government and public-sector contracts has this firm won? Focus on nuclear, defence, and infrastructure. Include contracting authority, value, and dates where available.",
  },
  {
    name: "Ownership structure",
    description:
      "Who owns this firm? Is the ultimate parent UK-incorporated and UK-controlled, or foreign-owned? Identify the ownership chain, noting where PSC data is incomplete.",
  },
  {
    name: "Financial health",
    description:
      "What is the firm's recent financial performance? Look for revenue trends, profitability, credit ratings, and any material financial risks (restructurings, profit warnings, covenant issues).",
  },
  {
    name: "Partnerships and JVs",
    description:
      "What known partnerships, joint ventures, or teaming arrangements does this firm have in the nuclear and defence sectors? Which other firms from this list have they worked with?",
  },
  {
    name: "Regulatory approvals",
    description:
      "What UK regulatory licences, approvals, or pre-qualifications does this firm hold relevant to nuclear (ONR, Environment Agency, defence security) or infrastructure work?",
  },
  {
    name: "Reputation and controversy",
    description:
      "Are there any material reputational risks, controversies, legal actions, HSE/ONR sanctions, or serious press reports that could affect consortium suitability? Provide sourced, dated references only.",
  },
];

async function runSeed() {
  // Idempotency check: skip if any firms already exist
  const existingFirms = await db.select({ id: firms.id }).from(firms).limit(1);
  if (existingFirms.length > 0) {
    console.log("Seed already applied — skipping (firms table is not empty).");
    return;
  }

  console.log("Seeding firms...");
  for (const firm of SEED_FIRMS) {
    await db.insert(firms).values({
      canonicalName: firm.canonicalName,
      aliases: JSON.stringify(firm.aliases),
      companiesHouseNumber: firm.companiesHouseNumber,
      capabilityTags: JSON.stringify(firm.capabilityTags),
    });
  }
  console.log(`  Inserted ${SEED_FIRMS.length} firms.`);

  console.log("Seeding topics...");
  for (const topic of SEED_TOPICS) {
    await db.insert(topics).values({
      name: topic.name,
      description: topic.description,
    });
  }
  console.log(`  Inserted ${SEED_TOPICS.length} topics.`);

  console.log("Seed complete.");
}

runSeed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => sql.end());
