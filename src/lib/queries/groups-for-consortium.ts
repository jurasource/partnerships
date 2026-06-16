import { db } from "@/db/client";
import { groups, firmGroups } from "@/db/schema";
import { asc } from "drizzle-orm";

export type GroupForConsortium = {
  id: string;
  name: string;
  firmIds: string[];
};

export async function getGroupsForConsortium(): Promise<GroupForConsortium[]> {
  const [groupRows, junctionRows] = await Promise.all([
    db.select({ id: groups.id, name: groups.name }).from(groups).orderBy(asc(groups.name)),
    db.select({ groupId: firmGroups.groupId, firmId: firmGroups.firmId }).from(firmGroups),
  ]);

  const memberMap = new Map<string, string[]>();
  for (const row of junctionRows) {
    const arr = memberMap.get(row.groupId) ?? [];
    arr.push(row.firmId);
    memberMap.set(row.groupId, arr);
  }

  return groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    firmIds: memberMap.get(g.id) ?? [],
  }));
}
