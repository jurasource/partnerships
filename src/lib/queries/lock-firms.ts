import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { asc } from "drizzle-orm";

/**
 * LockFirmsListItem — minimal projection used by the lock-firms accordion.
 */
export type LockFirmsListItem = {
  id: string;
  canonicalName: string;
  tags: string[];
};

/**
 * getLockFirmsList — fetch all firms (id, canonicalName, capabilityTags)
 * ordered alphabetically by canonicalName.
 *
 * capabilityTags is a JSON text column — parse to string[] before returning.
 *
 * Mirror of comparison-rows.ts pattern: direct db.select, no JOIN complexity.
 */
export async function getLockFirmsList(): Promise<LockFirmsListItem[]> {
  const rows = await db
    .select({
      id: firms.id,
      canonicalName: firms.canonicalName,
      capabilityTags: firms.capabilityTags,
    })
    .from(firms)
    .orderBy(asc(firms.canonicalName));

  return rows.map((row) => ({
    id: row.id,
    canonicalName: row.canonicalName,
    tags: JSON.parse(row.capabilityTags ?? "[]") as string[],
  }));
}
