import type { InferSelectModel } from "drizzle-orm";
import type {
  firms,
  topics,
  procurementRecords,
  jobs,
  findings,
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
