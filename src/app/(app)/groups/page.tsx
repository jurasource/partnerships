import { Layers } from "lucide-react";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups, firmGroups } from "@/db/schema";
import { GroupsTable } from "@/components/groups/groups-table";
import { GroupFormDialog } from "@/components/groups/group-form-dialog";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      firmCount: count(firmGroups.firmId),
    })
    .from(groups)
    .leftJoin(firmGroups, eq(firmGroups.groupId, groups.id))
    .groupBy(groups.id, groups.name)
    .orderBy(groups.name);

  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    firmCount: Number(r.firmCount),
  }));

  return (
    <main className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Groups
        </h1>
        <GroupFormDialog />
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-neutral-100 p-4">
              <Layers className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-700 mb-2">
              No groups yet
            </h2>
            <p className="text-sm text-neutral-500 max-w-sm mb-6">
              Create a group to organise firms for consortium planning.
            </p>
            <GroupFormDialog />
          </div>
        ) : (
          <GroupsTable data={data} />
        )}
      </div>
    </main>
  );
}
