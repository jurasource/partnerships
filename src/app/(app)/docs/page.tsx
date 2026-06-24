import Link from "next/link";
import { ArrowRight, FileText, FolderOpen } from "lucide-react";

import { buildDocTree, getAllDocMeta } from "@/lib/docs";
import type { DocTreeNode } from "@/lib/docs/types";

export const metadata = { title: "Documentation" };

/** Count leaf docs in a subtree. */
function countDocs(node: DocTreeNode): number {
  if (node.doc) return 1;
  return node.children.reduce((sum, c) => sum + countDocs(c), 0);
}

export default function DocsIndexPage() {
  const tree = buildDocTree();
  const total = getAllDocMeta().length;
  const rootFiles = tree.filter((n) => n.doc);
  const folders = tree.filter((n) => !n.doc);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900">Documentation</h1>
      <p className="mt-2 text-neutral-600">
        Project planning and design documents — {total} files from the{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-sm">.planning</code> directory.
        Browse the tree on the left or search across all docs.
      </p>

      {rootFiles.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Top-level documents
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {rootFiles.map((node) => (
              <li key={node.segment}>
                <Link
                  href={`/docs/${node.doc!.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
                  <span className="flex-1 truncate font-medium">{node.name}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {folders.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Sections
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {folders.map((node) => (
              <li
                key={node.segment}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700"
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="flex-1 truncate font-medium">{node.name}</span>
                <span className="shrink-0 text-xs text-neutral-400">{countDocs(node)} docs</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
