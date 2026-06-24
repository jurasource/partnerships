import type {
  DocMeta,
  DocSearchRecord,
  DocTreeNode,
  GeneratedDoc,
} from "./types";

/** Strip content from a doc, leaving client-safe metadata. */
export function toMeta(doc: GeneratedDoc): DocMeta {
  const { content: _content, ...meta } = doc;
  return meta;
}

/** Look up a doc by its slug segments. Pure map lookup — no filesystem access. */
export function findDocBySlug(
  docs: GeneratedDoc[],
  segments: string[]
): GeneratedDoc | undefined {
  if (!segments.length) return undefined;
  const slug = segments.join("/");
  return docs.find((d) => d.slug === slug);
}

/** Full-text search records (slug, title, path, content). */
export function buildSearchRecords(docs: GeneratedDoc[]): DocSearchRecord[] {
  return docs.map(({ slug, title, relPath, content }) => ({
    slug,
    title,
    relPath,
    content,
  }));
}

function sortNodes(nodes: DocTreeNode[]): DocTreeNode[] {
  nodes.sort((a, b) => {
    const aFolder = !a.doc;
    const bFolder = !b.doc;
    // Folders before files, then alphabetical by display name.
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children.length) sortNodes(node.children);
  }
  return nodes;
}

/**
 * Build the nested sidebar tree from docs. Folder nodes are named by their path
 * segment; leaf nodes by the document title. Sorted folders-first, alphabetical.
 */
export function buildTreeFromDocs(docs: GeneratedDoc[]): DocTreeNode[] {
  const roots: DocTreeNode[] = [];
  const byPath = new Map<string, DocTreeNode>();

  for (const doc of docs) {
    let parentChildren = roots;
    let accumulated = "";

    doc.segments.forEach((segment, i) => {
      const isLeaf = i === doc.segments.length - 1;
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;

      if (isLeaf) {
        parentChildren.push({
          name: doc.title,
          segment,
          doc: toMeta(doc),
          children: [],
        });
        return;
      }

      let node = byPath.get(accumulated);
      if (!node) {
        node = { name: segment, segment, children: [] };
        byPath.set(accumulated, node);
        parentChildren.push(node);
      }
      parentChildren = node.children;
    });
  }

  return sortNodes(roots);
}
