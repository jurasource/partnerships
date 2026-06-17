/**
 * Seed file: 7 research topics with Tavily search terms (CONF-06).
 *
 * Firms are NOT seeded — they are user-configured via the Config UI.
 *
 * Seed is IDEMPOTENT: skips inserts if any topics already exist.
 */

import { db, sql } from "./client";
import { topics } from "./schema";
import { eq, and } from "drizzle-orm";

type SeedTopic = {
  name: string;
  description: string;
  searchTerms: string;
};

const SEED_TOPICS: SeedTopic[] = [
  {
    name: "UK nuclear capability",
    description:
      "What nuclear capabilities (technology, services, projects) does this firm hold in the UK? Which reactor programmes, decommissioning frameworks, or safety/engineering roles are they involved in?",
    searchTerms: "nuclear capability sites contracts UK",
  },
  {
    name: "Past government contracts",
    description:
      "What UK government and public-sector contracts has this firm won? Focus on nuclear and infrastructure. Include contracting authority, value, and dates where available.",
    searchTerms: "UK government contracts procurement awards",
  },
  {
    name: "Ownership structure",
    description:
      "Who owns this firm? Is the ultimate parent UK-incorporated and UK-controlled, or foreign-owned? Identify the ownership chain, noting where PSC data is incomplete.",
    searchTerms: "parent company ownership structure UK",
  },
  {
    name: "Financial health",
    description:
      "What is the firm's recent financial performance? Look for revenue trends, profitability, credit ratings, and any material financial risks (restructurings, profit warnings, covenant issues).",
    searchTerms: "annual report financial results revenue UK",
  },
  {
    name: "Partnerships and JVs",
    description:
      "What known partnerships, joint ventures, or teaming arrangements does this firm have in the nuclear sector? Which other firms from this list have they worked with?",
    searchTerms: "joint venture partnership teaming agreement UK",
  },
  {
    name: "Regulatory approvals",
    description:
      "What UK regulatory licences, approvals, or pre-qualifications does this firm hold relevant to nuclear (ONR, Environment Agency) or infrastructure work?",
    searchTerms: "regulatory licence certification ONR UK approval",
  },
  {
    name: "Reputation and controversy",
    description:
      "Are there any material reputational risks, controversies, legal actions, HSE/ONR sanctions, or serious press reports that could affect consortium suitability? Provide sourced, dated references only.",
    searchTerms: "controversy legal dispute investigation sanctions",
  },
];

async function runSeed() {
  const existingTopics = await db.select({ id: topics.id }).from(topics).limit(1);

  if (existingTopics.length > 0) {
    // Topics already exist — backfill searchTerms for any row still using the empty default.
    // Skips rows the user has already customised (searchTerms !== "").
    console.log("Topics already exist — backfilling empty searchTerms...");
    for (const topic of SEED_TOPICS) {
      await db
        .update(topics)
        .set({ searchTerms: topic.searchTerms })
        .where(and(eq(topics.name, topic.name), eq(topics.searchTerms, "")));
    }
    console.log("  Backfill complete.");
    return;
  }

  console.log("Seeding topics...");
  for (const topic of SEED_TOPICS) {
    await db.insert(topics).values({
      name: topic.name,
      description: topic.description,
      searchTerms: topic.searchTerms,
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
