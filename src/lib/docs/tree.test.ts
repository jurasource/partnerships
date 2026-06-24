import { describe, expect, it } from "vitest";

import {
  buildSearchRecords,
  buildTreeFromDocs,
  findDocBySlug,
  toMeta,
} from "./tree";
import type { GeneratedDoc } from "./types";

function doc(relPath: string, title: string, content = "body"): GeneratedDoc {
  const slug = relPath.replace(/\.md$/, "");
  return { slug, relPath, segments: relPath.split("/"), title, content };
}

const FIXTURE: GeneratedDoc[] = [
  doc("PROJECT.md", "Project"),
  doc("ROADMAP.md", "Roadmap"),
  doc("phases/01-foundation/01-PLAN.md", "Foundation Plan", "alpha bravo"),
  doc("phases/01-foundation/01-SUMMARY.md", "Foundation Summary"),
  doc("research/STACK.md", "Stack"),
];

describe("buildTreeFromDocs", () => {
  it("nests files under their folders", () => {
    const tree = buildTreeFromDocs(FIXTURE);
    const phases = tree.find((n) => n.segment === "phases");
    expect(phases).toBeDefined();
    expect(phases!.doc).toBeUndefined();
    const foundation = phases!.children.find((n) => n.segment === "01-foundation");
    expect(foundation!.children).toHaveLength(2);
    expect(foundation!.children.map((c) => c.name)).toContain("Foundation Plan");
  });

  it("orders folders before files at the root", () => {
    const tree = buildTreeFromDocs(FIXTURE);
    const folderIndex = tree.findIndex((n) => !n.doc);
    const fileIndex = tree.findIndex((n) => n.doc);
    expect(folderIndex).toBeLessThan(fileIndex);
  });

  it("labels leaf nodes by document title", () => {
    const tree = buildTreeFromDocs(FIXTURE);
    const project = tree.find((n) => n.segment === "PROJECT.md");
    expect(project!.name).toBe("Project");
  });
});

describe("findDocBySlug", () => {
  it("resolves nested slugs", () => {
    const found = findDocBySlug(FIXTURE, ["phases", "01-foundation", "01-PLAN"]);
    expect(found?.title).toBe("Foundation Plan");
  });

  it("returns undefined for empty or unknown slugs", () => {
    expect(findDocBySlug(FIXTURE, [])).toBeUndefined();
    expect(findDocBySlug(FIXTURE, ["does", "not", "exist"])).toBeUndefined();
  });

  it("does not resolve traversal-style slugs to a real doc", () => {
    // A `..` segment can never match a stored slug, so traversal is impossible.
    expect(findDocBySlug(FIXTURE, ["..", "..", "etc", "passwd"])).toBeUndefined();
  });
});

describe("toMeta", () => {
  it("strips content", () => {
    const meta = toMeta(FIXTURE[0]);
    expect("content" in meta).toBe(false);
    expect(meta.title).toBe("Project");
  });
});

describe("buildSearchRecords", () => {
  it("includes content for full-text matching", () => {
    const records = buildSearchRecords(FIXTURE);
    expect(records).toHaveLength(FIXTURE.length);
    const planRecord = records.find((r) => r.slug === "phases/01-foundation/01-PLAN");
    expect(planRecord?.content).toContain("alpha bravo");
  });
});
