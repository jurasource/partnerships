import { eq, desc, or } from "drizzle-orm";

import { db } from "@/db/client";
import {
  firms,
  topics,
  findings,
  procurementRecords,
  ownershipRecords,
  riskFlags,
  collaborationRecords,
  conflictPairs,
  partnershipPairs,
  jvLeads,
} from "@/db/schema";
import type {
  Firm,
  Topic,
  Finding,
  ProcurementRecord,
  OwnershipRecord,
  RiskFlag,
  CollaborationRecord,
  ConflictPair,
  PartnershipPair,
  JvLead,
} from "@/lib/types";

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
 * Extended in Phase 4 to include cross-cutting analysis data.
 */
export type FirmProfile = {
  firm: Firm;
  findingsByTopic: FindingByTopic[];
  contracts: ProcurementRecord[];
  /** Ownership record for this firm, or null if never researched / no CH data. */
  ownership: OwnershipRecord | null;
  /** Risk flags for this firm, sorted by extraction order (caller sorts by severity). */
  riskFlags: RiskFlag[];
  /** Collaboration record for this firm, or null if never researched. */
  collaboration: CollaborationRecord | null;
  /** Conflict pairs where this firm is either firmA or firmB. */
  conflicts: ConflictPair[];
  /** Partnership pairs where this firm is either firmA or firmB. */
  partnerships: PartnershipPair[];
  /** JV partners mentioned in AI research but not yet tracked in the DB. */
  jvLeads: JvLead[];
};

/**
 * getFirmProfile — aggregates a firm's row, per-topic findings, procurement records,
 * and Phase 4 cross-cutting data (ownership, risk flags, collaboration, conflicts, partnerships).
 *
 * Performs one initial read (firm row), then eight parallel reads:
 * 1. Firm row (returns null if absent — T-03-01: parameterised lookup, 404 on unknown)
 * 2. All topics from the topics table (dynamic — never hard-coded)
 * 3. All findings for this firmId
 * 4. All procurement records for this firmId ordered by awardDate DESC
 * 5. Ownership record (limit 1 — unique per firm)
 * 6. Risk flags for this firmId
 * 7. Collaboration record (limit 1 — unique per firm)
 * 8. Conflict pairs where this firm is firmA or firmB
 * 9. Partnership pairs where this firm is firmA or firmB
 * 10. JV leads for this firmId (untracked JV partner mentions)
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

  // 2-9. Fetch all dependent data in parallel to reduce latency.
  const [
    allTopics,
    firmFindings,
    contracts,
    ownershipRows,
    riskFlagRows,
    collaborationRows,
    firmConflicts,
    firmPartnerships,
    jvLeadRows,
  ] = await Promise.all([
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
    db
      .select()
      .from(ownershipRecords)
      .where(eq(ownershipRecords.firmId, firmId))
      .limit(1),
    db.select().from(riskFlags).where(eq(riskFlags.firmId, firmId)),
    db
      .select()
      .from(collaborationRecords)
      .where(eq(collaborationRecords.firmId, firmId))
      .limit(1),
    db
      .select()
      .from(conflictPairs)
      .where(
        or(eq(conflictPairs.firmAId, firmId), eq(conflictPairs.firmBId, firmId)),
      ),
    db
      .select()
      .from(partnershipPairs)
      .where(
        or(eq(partnershipPairs.firmAId, firmId), eq(partnershipPairs.firmBId, firmId)),
      ),
    db.select().from(jvLeads).where(eq(jvLeads.sourceFirmId, firmId)),
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
    ownership: ownershipRows[0] ?? null,
    riskFlags: riskFlagRows,
    collaboration: collaborationRows[0] ?? null,
    conflicts: firmConflicts,
    partnerships: firmPartnerships,
    jvLeads: jvLeadRows,
  };
}
