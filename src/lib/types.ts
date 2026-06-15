import type { InferSelectModel } from "drizzle-orm";
import type {
  firms,
  topics,
  procurementRecords,
  jobs,
  findings,
  ownershipRecords,
  riskFlags,
  collaborationRecords,
  conflictPairs,
  partnershipPairs,
  groups,
  firmGroups,
} from "@/db/schema";

/**
 * Capability tags — data-driven (Pitfall 10).
 * The initial seed uses these three; users can extend via the config UI.
 */
export type CapabilityTag = "Nuclear" | "Infrastructure" | "Consultancy";

// Row types inferred directly from the Drizzle schema
export type Firm = InferSelectModel<typeof firms>;
export type Topic = InferSelectModel<typeof topics>;
export type ProcurementRecord = InferSelectModel<typeof procurementRecords>;
export type Job = InferSelectModel<typeof jobs>;
export type Finding = InferSelectModel<typeof findings>;
export type Group = InferSelectModel<typeof groups>;
export type FirmGroup = InferSelectModel<typeof firmGroups>;

// Cross-cutting row types (Phase 4)
export type OwnershipRecord = InferSelectModel<typeof ownershipRecords>;
export type RiskFlag = InferSelectModel<typeof riskFlags>;
export type CollaborationRecord = InferSelectModel<typeof collaborationRecords>;
export type ConflictPair = InferSelectModel<typeof conflictPairs>;
export type PartnershipPair = InferSelectModel<typeof partnershipPairs>;
