import "server-only";

import { DOCS } from "./docs.generated";
import {
  buildSearchRecords,
  buildTreeFromDocs,
  findDocBySlug,
  toMeta,
} from "./tree";
import type { DocMeta, DocSearchRecord, DocTreeNode, GeneratedDoc } from "./types";

/** All docs with full content (server-only). */
export function getAllDocs(): GeneratedDoc[] {
  return DOCS;
}

/** All docs as lightweight metadata (no content) — safe to pass to client. */
export function getAllDocMeta(): DocMeta[] {
  return DOCS.map(toMeta);
}

/** Look up a doc by its slug segments (from the `[...slug]` route). */
export function getDocBySlug(segments: string[]): GeneratedDoc | undefined {
  return findDocBySlug(DOCS, segments);
}

/** Full-text search records for the client search index. */
export function getSearchRecords(): DocSearchRecord[] {
  return buildSearchRecords(DOCS);
}

/** Nested sidebar navigation tree. */
export function buildDocTree(): DocTreeNode[] {
  return buildTreeFromDocs(DOCS);
}
