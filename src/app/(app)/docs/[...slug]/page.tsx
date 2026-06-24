import { notFound } from "next/navigation";

import { getAllDocs, getDocBySlug } from "@/lib/docs";
import { Markdown } from "@/components/docs/markdown";

type Params = { slug: string[] };

export function generateStaticParams(): Params[] {
  return getAllDocs().map((doc) => ({ slug: doc.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  return { title: doc ? `${doc.title} · Docs` : "Documentation" };
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  return (
    <article>
      <p className="mb-4 font-mono text-xs text-neutral-400">{doc.relPath}</p>
      <Markdown content={doc.content} relPath={doc.relPath} />
    </article>
  );
}
