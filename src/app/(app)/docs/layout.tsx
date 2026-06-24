import { buildDocTree } from "@/lib/docs";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = buildDocTree();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white">
      <DocsSidebar tree={tree} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
