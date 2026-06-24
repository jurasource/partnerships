"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type Fuse from "fuse.js";
import { FileText, Loader2, Search } from "lucide-react";

import type { DocSearchRecord } from "@/lib/docs/types";

interface Result {
  record: DocSearchRecord;
  snippet: string;
}

/** Build a ~120-char snippet around the first query hit in the content. */
function buildSnippet(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, 120).trim() + "…";
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + 80);
  return (start > 0 ? "…" : "") + content.slice(start, end).trim() + "…";
}

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const fuseRef = useRef<Fuse<DocSearchRecord> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy-load the index + Fuse on first interaction.
  async function ensureIndex() {
    if (fuseRef.current) return;
    setLoading(true);
    try {
      const [{ default: FuseCtor }, res] = await Promise.all([
        import("fuse.js"),
        fetch("/api/docs/search-index"),
      ]);
      const records: DocSearchRecord[] = await res.json();
      fuseRef.current = new FuseCtor(records, {
        keys: [
          { name: "title", weight: 3 },
          { name: "relPath", weight: 1 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!query.trim() || !fuseRef.current) {
      setResults([]);
      return;
    }
    const hits = fuseRef.current.search(query, { limit: 12 });
    setResults(
      hits.map((h) => ({
        record: h.item,
        snippet: buildSnippet(h.item.content, query),
      }))
    );
  }, [query]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input
          type="search"
          value={query}
          placeholder="Search docs…"
          onFocus={() => {
            setOpen(true);
            void ensureIndex();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-8 pr-8 text-sm outline-none focus:border-neutral-400"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute z-50 mt-1 max-h-96 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-neutral-500">
              {loading ? "Loading index…" : "No matches."}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {results.map(({ record, snippet }) => (
                <li key={record.slug}>
                  <Link
                    href={`/docs/${record.slug}`}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 hover:bg-neutral-50"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      {record.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-neutral-400">
                      {record.relPath}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{snippet}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
