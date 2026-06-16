import { getLockFirmsList } from "@/lib/queries/lock-firms";

import { RecommendClient } from "./recommend-client";

export const dynamic = "force-dynamic";

/**
 * RecommendPage — RSC shell.
 *
 * Loads firm list server-side (avoids client-side DB fetch) and passes it
 * into the RecommendClient island. All interactive state lives in the client.
 */
export default async function RecommendPage() {
  const firms = await getLockFirmsList();

  return (
    <main className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Consortium Recommender
        </h1>
      </header>

      {/* Content */}
      <div className="px-6 py-6 max-w-3xl mx-auto w-full flex flex-col gap-8">
        <RecommendClient firms={firms} />
      </div>
    </main>
  );
}
