/** One Markdown document snapshotted from `.planning/` at build time. */
export interface GeneratedDoc {
  /** URL slug = relative path without the `.md` extension, e.g. `phases/01-data-foundation/01-01-PLAN`. */
  slug: string;
  /** Path relative to `.planning/`, e.g. `phases/01-data-foundation/01-01-PLAN.md`. */
  relPath: string;
  /** `relPath` split on `/`. */
  segments: string[];
  /** First `# Heading` in the doc, else a humanized filename. */
  title: string;
  /** Raw Markdown content. */
  content: string;
}

/** Lightweight doc metadata (no content) — safe to send to client components. */
export type DocMeta = Omit<GeneratedDoc, "content">;

/** A node in the sidebar navigation tree. */
export interface DocTreeNode {
  /** Display name for this segment (folder name or doc title). */
  name: string;
  /** Path segment used to build the tree path. */
  segment: string;
  /** Set when this node is a document (leaf). */
  doc?: DocMeta;
  /** Child nodes, sorted folders-first then alphabetically. */
  children: DocTreeNode[];
}

/** A single full-text search record. */
export interface DocSearchRecord {
  slug: string;
  title: string;
  relPath: string;
  content: string;
}
