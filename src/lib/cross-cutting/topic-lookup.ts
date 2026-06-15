/**
 * Topic name constants and finding lookup helper for cross-cutting extraction.
 *
 * Topic names match the seeded values in src/db/seed.ts exactly.
 * Phase 2 critical correction: there is NO "conflicts between firms" or
 * "which firms not UK owned" topic — use these exact names.
 *
 * NO "server-only" import — must be importable by the standalone worker process.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { findings, topics } from "@/db/schema";
import type { Finding } from "@/lib/types";

/**
 * Canonical topic names as seeded in src/db/seed.ts.
 * Keys map to the extraction consumer:
 *   - ownership  → extractOwnership()
 *   - financial  → extractRiskFlags() (financial flags)
 *   - regulatory → extractRiskFlags() (regulatory flags)
 *   - reputation → extractRiskFlags() (reputational flags)
 *   - partnerships → extractCollaborationAndPartnerships() (Phase 4 plan 02)
 */
export const TOPIC_NAMES = {
  ownership: "Ownership structure",
  financial: "Financial health",
  regulatory: "Regulatory approvals",
  reputation: "Reputation and controversy",
  partnerships: "Partnerships and JVs",
} as const;

/**
 * Look up a finding for a firm by topic name.
 *
 * Performs a two-step lookup:
 * 1. Find the topic ID by name (from the topics table)
 * 2. Find the finding for this firm + topic ID
 *
 * Returns the finding row or null if either the topic or finding is absent.
 * Uses parameterised queries only (T-04-01 — no string interpolation).
 *
 * @param firmId    ID of the firm to look up
 * @param topicName Exact topic name string (use TOPIC_NAMES constant)
 */
export async function findFindingByTopicName(
  firmId: string,
  topicName: string,
): Promise<Finding | null> {
  // Step 1: resolve topic ID by name
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.name, topicName))
    .limit(1);

  if (!topic) return null;

  // Step 2: find the finding for this firm + topic
  const [finding] = await db
    .select()
    .from(findings)
    .where(and(eq(findings.firmId, firmId), eq(findings.topicId, topic.id)))
    .limit(1);

  return finding ?? null;
}
