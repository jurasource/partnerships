import { inArray, or, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  firms,
  findings,
  topics,
  riskFlags,
  ownershipRecords,
  partnershipPairs,
  conflictPairs,
} from "@/db/schema";
import type { ConsortiumFirmContext } from "@/lib/consortium/types";

type IncludeFlags = {
  findings: boolean;
  riskFlags: boolean;
  partnerships: boolean;
  ownership: boolean;
};

export async function getConsortiumPromptData(
  firmIds: string[],
  include: IncludeFlags,
): Promise<ConsortiumFirmContext[]> {
  if (firmIds.length === 0) return [];

  const findingsQuery = include.findings
    ? db
        .select({
          firmId: findings.firmId,
          summary: findings.summary,
          sourceTitle: findings.sourceTitle,
          sourceUrl: findings.sourceUrl,
          topicName: topics.name,
        })
        .from(findings)
        .innerJoin(topics, eq(topics.id, findings.topicId))
        .where(inArray(findings.firmId, firmIds))
    : Promise.resolve([] as { firmId: string; summary: string; sourceTitle: string; sourceUrl: string; topicName: string }[]);

  const riskFlagsQuery = include.riskFlags
    ? db
        .select({
          firmId: riskFlags.firmId,
          flagType: riskFlags.flagType,
          severity: riskFlags.severity,
          description: riskFlags.description,
        })
        .from(riskFlags)
        .where(inArray(riskFlags.firmId, firmIds))
    : Promise.resolve([] as { firmId: string; flagType: string; severity: string; description: string }[]);

  const ownershipQuery = include.ownership
    ? db
        .select({
          firmId: ownershipRecords.firmId,
          ukIncorporated: ownershipRecords.ukIncorporated,
          ultimateParent: ownershipRecords.ultimateParent,
          countryOfOwnership: ownershipRecords.countryOfOwnership,
        })
        .from(ownershipRecords)
        .where(inArray(ownershipRecords.firmId, firmIds))
    : Promise.resolve([] as { firmId: string; ukIncorporated: "yes" | "no" | "unknown"; ultimateParent: string | null; countryOfOwnership: string | null }[]);

  const partnershipQuery = include.partnerships
    ? db
        .select({
          firmAId: partnershipPairs.firmAId,
          firmBId: partnershipPairs.firmBId,
          partnershipType: partnershipPairs.partnershipType,
          evidenceSummary: partnershipPairs.evidenceSummary,
          evidenceDate: partnershipPairs.evidenceDate,
        })
        .from(partnershipPairs)
        .where(
          or(
            inArray(partnershipPairs.firmAId, firmIds),
            inArray(partnershipPairs.firmBId, firmIds),
          ),
        )
    : Promise.resolve([] as { firmAId: string; firmBId: string; partnershipType: string; evidenceSummary: string; evidenceDate: string | null }[]);

  const conflictQuery = include.partnerships
    ? db
        .select({
          firmAId: conflictPairs.firmAId,
          firmBId: conflictPairs.firmBId,
          conflictType: conflictPairs.conflictType,
          evidenceSummary: conflictPairs.evidenceSummary,
        })
        .from(conflictPairs)
        .where(
          or(
            inArray(conflictPairs.firmAId, firmIds),
            inArray(conflictPairs.firmBId, firmIds),
          ),
        )
    : Promise.resolve([] as { firmAId: string; firmBId: string; conflictType: string; evidenceSummary: string }[]);

  const [firmRows, findingRows, riskFlagRows, ownershipRows, partnershipRows, conflictRows] =
    await Promise.all([
      db
        .select({ id: firms.id, canonicalName: firms.canonicalName, capabilityTags: firms.capabilityTags })
        .from(firms)
        .where(inArray(firms.id, firmIds)),
      findingsQuery,
      riskFlagsQuery,
      ownershipQuery,
      partnershipQuery,
      conflictQuery,
    ]);

  const firmNameById = new Map(firmRows.map((f) => [f.id, f.canonicalName]));

  // Partnerships/conflicts may reference firms outside the selected group — fetch those names too.
  const selectedFirmIdSet = new Set(firmIds);
  const extraFirmIds = new Set<string>();
  for (const p of partnershipRows) {
    if (!selectedFirmIdSet.has(p.firmAId)) extraFirmIds.add(p.firmAId);
    if (!selectedFirmIdSet.has(p.firmBId)) extraFirmIds.add(p.firmBId);
  }
  for (const c of conflictRows) {
    if (!selectedFirmIdSet.has(c.firmAId)) extraFirmIds.add(c.firmAId);
    if (!selectedFirmIdSet.has(c.firmBId)) extraFirmIds.add(c.firmBId);
  }
  if (extraFirmIds.size > 0) {
    const extraRows = await db
      .select({ id: firms.id, canonicalName: firms.canonicalName })
      .from(firms)
      .where(inArray(firms.id, [...extraFirmIds]));
    for (const f of extraRows) firmNameById.set(f.id, f.canonicalName);
  }

  const ownershipByFirmId = new Map(ownershipRows.map((o) => [o.firmId, o]));

  return firmRows.map((firm): ConsortiumFirmContext => {
    let capabilityTags: string[] = [];
    try {
      const parsed = JSON.parse(firm.capabilityTags ?? "[]");
      capabilityTags = Array.isArray(parsed)
        ? parsed.filter((t): t is string => typeof t === "string")
        : [];
    } catch {
      capabilityTags = [];
    }

    const ownership = ownershipByFirmId.get(firm.id) ?? null;

    const firmRiskFlags = riskFlagRows
      .filter((r) => r.firmId === firm.id)
      .map((r) => ({ flagType: r.flagType, severity: r.severity, description: r.description }));

    const firmPartnerships = partnershipRows
      .filter((p) => p.firmAId === firm.id || p.firmBId === firm.id)
      .map((p) => {
        const partnerFirmId = p.firmAId === firm.id ? p.firmBId : p.firmAId;
        return {
          partnerFirmName: firmNameById.get(partnerFirmId) ?? partnerFirmId,
          partnershipType: p.partnershipType,
          evidenceSummary: p.evidenceSummary,
          evidenceDate: p.evidenceDate,
        };
      });

    const firmConflicts = conflictRows
      .filter((c) => c.firmAId === firm.id || c.firmBId === firm.id)
      .map((c) => {
        const otherFirmId = c.firmAId === firm.id ? c.firmBId : c.firmAId;
        return {
          otherFirmName: firmNameById.get(otherFirmId) ?? otherFirmId,
          conflictType: c.conflictType,
          evidenceSummary: c.evidenceSummary,
        };
      });

    const firmFindings = findingRows
      .filter((f) => f.firmId === firm.id)
      .map((f) => ({
        topicName: f.topicName,
        summary: f.summary,
        sourceTitle: f.sourceTitle,
        sourceUrl: f.sourceUrl,
      }));

    return {
      id: firm.id,
      canonicalName: firm.canonicalName,
      capabilityTags,
      ownership: ownership
        ? {
            ukIncorporated: ownership.ukIncorporated,
            ultimateParent: ownership.ultimateParent,
            countryOfOwnership: ownership.countryOfOwnership,
          }
        : null,
      riskFlags: firmRiskFlags,
      partnerships: firmPartnerships,
      conflicts: firmConflicts,
      findings: firmFindings,
    };
  });
}
