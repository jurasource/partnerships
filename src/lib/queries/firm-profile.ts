import { eq, desc } from "drizzle-orm";

import { db } from "@/db/client";
import { firms, topics, findings, procurementRecords } from "@/db/schema";
import type { Firm, Topic, Finding, ProcurementRecord } from "@/lib/types";

/**
 * A single topic + associated finding for one firm.
 *
 * sourceType:
 *   "structured" — HIGH confidence and NOT a not-found sentinel, OR is a not-found sentinel
 *   "ai"         — MEDIUM confidence
 *   null         — no finding exists for this topic
 *
 * isNotFound:
 *   true  — finding.sourceUrl === "not-found" (NOT_FOUND_SENTINEL was stored)
 *   false — real finding or no finding
 */
export type FindingByTopic = {
  topic: Topic;
  finding: Finding | null;
  sourceType: "structured" | "ai" | null;
  isNotFound: boolean;
};

/**
 * The aggregated firm profile returned by getFirmProfile.
 */
export type FirmProfile = {
  firm: Firm;
  findingsByTopic: FindingByTopic[];
  contracts: ProcurementRecord[];
};

/**
 * getFirmProfile — aggregates a firm's row, per-topic findings, and procurement records.
 *
 * Performs four sequential reads:
 * 1. Firm row (returns null if absent — T-03-01: parameterised lookup, 404 on unknown)
 * 2. All topics from the topics table (dynamic — never hard-coded)
 * 3. All findings for this firmId
 * 4. All procurement records for this firmId ordered by awardDate DESC
 *
 * Derives findingsByTopic: one entry per topic, joined on topicId.
 * sourceType derivation per plan spec:
 *   finding === null         → sourceType: null, isNotFound: false
 *   sourceUrl === "not-found" → sourceType: "structured", isNotFound: true
 *   confidence === "HIGH"    → sourceType: "structured", isNotFound: false
 *   confidence === "MEDIUM"  → sourceType: "ai", isNotFound: false
 *
 * Does NOT parse capabilityTags JSON — returned as raw firm row (consumer's responsibility).
 */
export async function getFirmProfile(firmId: string): Promise<FirmProfile | null> {
  // 1. Firm row lookup (T-03-01: parameterised eq, no string interpolation)
  const [firm] = await db
    .select()
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (!firm) {
    return null;
  }

  // 2. All topics — dynamic; never hard-coded count
  const allTopics = await db.select().from(topics);

  // 3. All findings for this firm
  const firmFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.firmId, firmId))
    .orderBy(desc(findings.createdAt));

  // 4. Procurement records ordered by awardDate DESC (nulls handled by DB, effectively last)
  const contracts = await db
    .select()
    .from(procurementRecords)
    .where(eq(procurementRecords.firmId, firmId))
    .orderBy(desc(procurementRecords.awardDate));

  // Build a lookup map: topicId → Finding
  const findingByTopicId = new Map<string, Finding>();
  for (const f of firmFindings) {
    findingByTopicId.set(f.topicId, f);
  }

  // Build findingsByTopic: one entry per topic
  const findingsByTopic: FindingByTopic[] = allTopics.map((topic) => {
    const finding = findingByTopicId.get(topic.id) ?? null;

    let sourceType: "structured" | "ai" | null = null;
    let isNotFound = false;

    if (finding !== null) {
      if (finding.sourceUrl === "not-found") {
        sourceType = "structured";
        isNotFound = true;
      } else if (finding.confidence === "HIGH") {
        sourceType = "structured";
      } else {
        // MEDIUM
        sourceType = "ai";
      }
    }

    return {
      topic,
      finding,
      sourceType,
      isNotFound,
    };
  });

  return {
    firm,
    findingsByTopic,
    contracts,
  };
}
