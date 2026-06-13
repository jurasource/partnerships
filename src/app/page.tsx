import Link from "next/link";
import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Minimal count check — full comparison table arrives in Plan 02
  const allFirms = await db.select({ id: firms.id }).from(firms);
  const firmCount = allFirms.length;

  return (
    <main className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Dashboard
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        {firmCount === 0 ? (
          /* Empty state (UI-SPEC Copywriting Contract) */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-neutral-100 p-4">
              <LayoutDashboard className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-700 mb-2">
              No firm data to compare
            </h2>
            <p className="text-sm text-neutral-500 max-w-sm mb-6">
              Add firms on the Firms screen to populate the comparison table.
            </p>
            <Button
              render={<Link href="/firms" />}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Go to Firms
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center">
            <p className="text-sm text-neutral-500">
              {firmCount} firm{firmCount !== 1 ? "s" : ""} in your list.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              The full firm comparison table arrives in Plan 02.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
