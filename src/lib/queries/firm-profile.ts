import { eq, desc } from "drizzle-orm";

import { db } from "@/db/client";
import { firms, topics, findings, procurementRecords } from "@/db/schema";
import type { Firm, Topic, Finding, ProcurementRecord } from "@/lib/types";

/**
 * A single topic + associated finding for one firm.
 *
 * sourceType:
 *   "structured" — HIGH confidence and NOT a sentinel, OR is a not-found/error sentinel
 *   "ai"         — MEDIUM confidence
 *   null         — no finding exists for this topic
 *
 * isNotFound:
 *   true  — finding.sourceUrl === "not-found" (NOT_FOUND_SENTINEL: genuine absence)
 *   false — real finding, error sentinel, or no finding
 *
 * isError:
 *   true  — finding.sourceUrl === "research-error" (RESEARCH_ERROR_SENTINEL: technical failure)
 *   false — real finding, not-found sentinel, or no finding
 */
export type FindingByTopic = {
  topic: Topic;
  finding: Finding | null;
  sourceType: "structured" | "ai" | null;
  isNotFound: boolean;
  isError: boolean;
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
 *   finding === null            → sourceType: null, isNotFound: false, isError: false
 *   sourceUrl === "not-found"   → sourceType: "structured", isNotFound: true, isError: false
 *   sourceUrl === "research-error" → sourceType: "structured", isNotFound: false, isError: true
 *   confidence === "HIGH"       → sourceType: "structured", isNotFound: false, isError: false
 *   confidence === "MEDIUM"     → sourceType: "ai", isNotFound: false, isError: false
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

  // 2-4. Fetch topics, findings, and contracts in parallel to reduce latency
  //      and narrow the TOCTOU window between topic and finding reads.
  const [allTopics, firmFindings, contracts] = await Promise.all([
    db.select().from(topics),
    db
      .select()
      .from(findings)
      .where(eq(findings.firmId, firmId))
      .orderBy(desc(findings.createdAt)),
    db
      .select()
      .from(procurementRecords)
      .where(eq(procurementRecords.firmId, firmId))
      .orderBy(desc(procurementRecords.awardDate)),
  ]);

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
    let isError = false;

    if (finding !== null) {
      if (finding.sourceUrl === "not-found") {
        sourceType = "structured";
        isNotFound = true;
      } else if (finding.sourceUrl === "research-error") {
        sourceType = "structured";
        isError = true;
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
      isError,
    };
  });

  return {
    firm,
    findingsByTopic,
    contracts,
  };
}
