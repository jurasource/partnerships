import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups, firmGroups, firms } from "@/db/schema";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params;

  // (a) Load the group
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) {
    notFound();
  }

  // (b) Load member firms via junction table
  const memberRows = await db
    .select({
      id: firms.id,
      canonicalName: firms.canonicalName,
    })
    .from(firms)
    .innerJoin(firmGroups, eq(firmGroups.firmId, firms.id))
    .where(eq(firmGroups.groupId, id))
    .orderBy(firms.canonicalName);

  // (c) All firms
  const allFirms = await db
    .select({ id: firms.id, canonicalName: firms.canonicalName })
    .from(firms)
    .orderBy(firms.canonicalName);

  // Compute non-members
  const memberIds = new Set(memberRows.map((f) => f.id));
  const nonMemberFirms = allFirms.filter((f) => !memberIds.has(f.id));

  return (
    <main className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="flex items-center gap-3 px-6 py-6 border-b border-neutral-200 bg-white">
        <Link
          href="/groups"
          className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Groups
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-medium text-neutral-900">
          {group.name}
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        <GroupDetailClient
          groupId={group.id}
          groupName={group.name}
          memberFirms={memberRows}
          nonMemberFirms={nonMemberFirms}
        />
      </div>
    </main>
  );
}
