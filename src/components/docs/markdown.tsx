"use client";

import Link from "next/link";
import { useId } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";

import { MermaidDiagram } from "@/components/how-it-works/mermaid-diagram";
import "highlight.js/styles/github.css";

interface MarkdownProps {
  content: string;
  /** Path of the current doc relative to `.planning/`, used to resolve relative `.md` links. */
  relPath: string;
}

/** Resolve a relative `.md` link against the current doc into a `/docs/...` route. */
function resolveDocHref(href: string, relPath: string): string | null {
  // Leave external links, anchors, mailto, and absolute paths untouched.
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith("#") || href.startsWith("mailto:")) {
    return null;
  }
  if (!href.includes(".md")) return null;

  const [rawPath, hash] = href.split("#");
  const baseDir = relPath.split("/").slice(0, -1);
  const segments = rawPath.split("/");

  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") baseDir.pop();
    else baseDir.push(seg);
  }

  const resolved = baseDir.join("/").replace(/\.md$/i, "");
  if (!resolved) return null;
  return `/docs/${resolved}${hash ? `#${hash}` : ""}`;
}

export function Markdown({ content, relPath }: MarkdownProps) {
  const baseId = useId().replace(/[:]/g, "");

  const components: Components = {
    a({ href, children, ...props }) {
      const raw = typeof href === "string" ? href : "";
      const docHref = resolveDocHref(raw, relPath);
      if (docHref) {
        return (
          <Link href={docHref} {...props}>
            {children}
          </Link>
        );
      }
      const external = /^[a-z]+:\/\//i.test(raw);
      return (
        <a
          href={raw}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          {...props}
        >
          {children}
        </a>
      );
    },
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const text = String(children ?? "").replace(/\n$/, "");

      if (match?.[1] === "mermaid") {
        return <MermaidDiagram chart={text} id={`${baseId}-${text.length}`} />;
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="prose prose-neutral max-w-none prose-headings:scroll-mt-20 prose-pre:bg-neutral-50 prose-pre:text-neutral-800 prose-pre:border prose-pre:border-neutral-200 prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-table:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeHighlight, { ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
