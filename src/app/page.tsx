import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonTable } from "@/components/dashboard/comparison-table";
import { getComparisonRows } from "@/lib/queries/comparison-rows";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // RSC direct DB read — firm comparison with contract counts (DASH-01)
  const rows = await getComparisonRows();

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
        {rows.length === 0 ? (
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
          <ComparisonTable rows={rows} />
        )}
      </div>

      {/* Icons8 attribution — required by Icons8 free licence */}
      <footer className="px-6 py-3 border-t border-neutral-100 text-xs text-neutral-400">
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://icons8.com/icon/92036/network"
          className="hover:text-neutral-600 underline underline-offset-2"
        >
          Network
        </a>{" "}
        icon by{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://icons8.com"
          className="hover:text-neutral-600 underline underline-offset-2"
        >
          Icons8
        </a>
      </footer>
    </main>
  );
}
