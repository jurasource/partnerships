import { BookOpen } from "lucide-react";
import { db } from "@/db/client";
import { topics } from "@/db/schema";
import { TopicsTable } from "@/components/topics/topics-table";
import { TopicFormDialog } from "@/components/topics/topic-form-dialog";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const allTopics = await db.select().from(topics).orderBy(topics.name);

  return (
    <main className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="flex items-center justify-between px-6 py-6 border-b border-neutral-200 bg-white">
        <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
          Topics
        </h1>
        <TopicFormDialog />
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        {allTopics.length === 0 ? (
          /* Empty state (UI-SPEC Copywriting Contract) */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-neutral-100 p-4">
              <BookOpen className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-700 mb-2">
              No research topics yet
            </h2>
            <p className="text-sm text-neutral-500 max-w-sm mb-6">
              Define the questions you want answered about each firm. Topics
              drive the research run in the next phase.
            </p>
            <TopicFormDialog />
          </div>
        ) : (
          <TopicsTable data={allTopics} />
        )}
      </div>
    </main>
  );
}
