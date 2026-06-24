"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, FileText, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocTreeNode } from "@/lib/docs/types";
import { DocsSearch } from "./docs-search";

interface DocsSidebarProps {
  tree: DocTreeNode[];
}

export function DocsSidebar({ tree }: DocsSidebarProps) {
  const pathname = usePathname();
  const activeSlug = decodeURIComponent(pathname.replace(/^\/docs\/?/, ""));

  return (
    <aside className="w-72 shrink-0 border-r border-neutral-200 bg-white">
      <div className="flex h-full flex-col">
        <div className="border-b border-neutral-100 p-3">
          <DocsSearch />
        </div>
        <nav className="flex-1 overflow-auto p-2">
          <Link
            href="/docs"
            className={cn(
              "mb-1 block rounded-md px-2 py-1.5 text-sm font-medium",
              pathname === "/docs"
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50"
            )}
          >
            Overview
          </Link>
          <ul>
            {tree.map((node) => (
              <TreeNode
                key={node.segment}
                node={node}
                path={node.segment}
                depth={0}
                activeSlug={activeSlug}
              />
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

interface TreeNodeProps {
  node: DocTreeNode;
  path: string;
  depth: number;
  activeSlug: string;
}

function TreeNode({ node, path, depth, activeSlug }: TreeNodeProps) {
  const isFolder = !node.doc;
  const containsActive = activeSlug === path || activeSlug.startsWith(`${path}/`);
  const [open, setOpen] = useState(containsActive);
  const indent = { paddingLeft: `${depth * 12 + 8}px` };

  if (isFolder) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={indent}
          className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform", open && "rotate-90")}
          />
          <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open && (
          <ul>
            {node.children.map((child) => (
              <TreeNode
                key={child.segment}
                node={child}
                path={`${path}/${child.segment}`}
                depth={depth + 1}
                activeSlug={activeSlug}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const slug = node.doc!.slug;
  const isActive = activeSlug === slug;
  return (
    <li>
      <Link
        href={`/docs/${slug}`}
        style={indent}
        className={cn(
          "flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm",
          isActive
            ? "bg-blue-50 font-medium text-blue-700"
            : "text-neutral-600 hover:bg-neutral-50"
        )}
      >
        <ChevronRight className="invisible h-3.5 w-3.5 shrink-0" />
        <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span className="truncate">{node.name}</span>
      </Link>
    </li>
  );
}
