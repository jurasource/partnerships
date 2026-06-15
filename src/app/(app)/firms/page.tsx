import { db } from "@/db/client";
import { firms, firmGroups, groups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { FirmsTable } from "@/components/firms/firms-table";
import { FirmFormDialog } from "@/components/firms/firm-form-dialog";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FirmsPage() {
  // RSC: read directly from the local Postgres cache (ARCHITECTURE boundary rule)
  const allFirms = await db.select().from(firms).orderBy(firms.canonicalName);

  // Fetch all group memberships and join with group names
  const memberships = await db
    .select({
      firmId: firmGroups.firmId,
      groupId: groups.id,
      groupName: groups.name,
    })
    .from(firmGroups)
    .innerJoin(groups, eq(firmGroups.groupId, groups.id));

  // Build a map keyed by firmId for O(1) lookup
  const membershipMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of memberships) {
    const existing = membershipMap.get(row.firmId) ?? [];
    existing.push({ id: row.groupId, name: row.groupName });
    membershipMap.set(row.firmId, existing);
  }

  // Extend each firm with its group membership array
  const firmsWithGroups = allFirms.map((firm) => ({
    ...firm,
    groups: membershipMap.get(firm.id) ?? [],
  }));

  return (
    <main className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Firms
        </h1>
        <FirmFormDialog />
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        {allFirms.length === 0 ? (
          /* Empty state (UI-SPEC Copywriting Contract) */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-neutral-100 p-4">
              <Building2 className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-700 mb-2">
              No firms yet
            </h2>
            <p className="text-sm text-neutral-500 max-w-sm mb-6">
              Add a firm to start building your intelligence list. You can enter
              a Companies House number directly or search for it.
            </p>
            <FirmFormDialog />
          </div>
        ) : (
          <FirmsTable data={firmsWithGroups} />
        )}
      </div>
    </main>
  );
}
