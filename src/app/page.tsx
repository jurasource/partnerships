import Link from "next/link";
import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonTable } from "@/components/dashboard/comparison-table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // RSC direct DB read — full firm comparison (read-only in Phase 1)
  const allFirms = await db.select().from(firms);

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
        {allFirms.length === 0 ? (
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
          <ComparisonTable firms={allFirms} />
        )}
      </div>
    </main>
  );
}
