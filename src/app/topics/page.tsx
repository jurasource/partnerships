import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TopicsPage() {
  return (
    <main className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Topics
        </h1>
        {/* Add Topic CTA — full Topics CRUD is Plan 02 */}
      </header>

      {/* Empty state (UI-SPEC Copywriting Contract) */}
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="mb-4 rounded-full bg-neutral-100 p-4">
          <BookOpen className="h-8 w-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">
          No research topics yet
        </h2>
        <p className="text-sm text-neutral-500 max-w-sm">
          Define the questions you want answered about each firm. Topics drive
          the research run in the next phase.
        </p>
        <p className="mt-4 text-xs text-neutral-400">
          Full topic management arrives in Plan 02.
        </p>
      </div>
    </main>
  );
}
