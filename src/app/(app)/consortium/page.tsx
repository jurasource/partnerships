import { getLockFirmsList } from "@/lib/queries/lock-firms";
import { getGroupsForConsortium } from "@/lib/queries/groups-for-consortium";

import { ConsortiumClient } from "./consortium-client";

export const dynamic = "force-dynamic";

export default async function ConsortiumPage() {
  const [firms, groups] = await Promise.all([
    getLockFirmsList(),
    getGroupsForConsortium(),
  ]);

  return (
    <main className="flex flex-col min-h-full">
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Consortium
        </h1>
      </header>

      <div className="px-6 py-6 max-w-3xl mx-auto w-full flex flex-col gap-8">
        <ConsortiumClient firms={firms} groups={groups} />
      </div>
    </main>
  );
}
