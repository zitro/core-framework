"use client";

/**
 * MarkdownView — typographic markdown renderer used across the app.
 *
 * Features:
 * - GitHub-flavored markdown (tables, task lists, strikethrough)
 * - Slugged headings (deep-linkable; hover shows §)
 * - Code blocks with syntax highlighting (theme follows dark mode)
 * - Bordered, zebra tables wrapped in a horizontal scroller
 * - Tailwind `prose` typography, capped at `max-w-prose`
 */

import { useEffect, useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownViewProps {
  children: string;
  className?: string;
}

// Strip leading YAML frontmatter (--- ... ---) and HTML comments so they
// don't render as inline text. Markdown source from vertex repos and
// templates often contains both as guidance for human authors.
function sanitize(source: string): string {
  let out = source;
  if (out.startsWith("---\n") || out.startsWith("---\r\n")) {
    const end = out.indexOf("\n---", 3);
    if (end !== -1) {
      const after = out.indexOf("\n", end + 4);
      out = after === -1 ? "" : out.slice(after + 1);
    }
  }
  return out.replace(/<!--[\s\S]*?-->/g, "");
}

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

type CodeProps = ComponentProps<"code"> & { inline?: boolean };

export function MarkdownView({ children, className }: MarkdownViewProps) {
  const dark = useIsDark();

  const components: Components = {
    code(props) {
      const { inline, className: cls, children: content, ...rest } = props as CodeProps;
      const match = /language-(\w+)/.exec(cls || "");
      const text = String(content ?? "").replace(/\n$/, "");
      if (!inline && match) {
        return (
          <SyntaxHighlighter
            language={match[1]}
            style={dark ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              padding: "0.875rem 1rem",
            }}
            PreTag="div"
          >
            {text}
          </SyntaxHighlighter>
        );
      }
      return (
        <code className={cls} {...rest}>
          {content}
        </code>
      );
    },
    table({ children: c }) {
      return (
        <div className="not-prose my-4 overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">{c}</table>
        </div>
      );
    },
    thead({ children: c }) {
      return <thead className="bg-muted/60">{c}</thead>;
    },
    th({ children: c }) {
      return (
        <th className="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {c}
        </th>
      );
    },
    td({ children: c }) {
      return <td className="border-b px-3 py-2 align-top">{c}</td>;
    },
    tr({ children: c }) {
      return <tr className="even:bg-muted/30">{c}</tr>;
    },
    a({ children: c, href, ...rest }) {
      const external = href?.startsWith("http");
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
          className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          {...rest}
        >
          {c}
        </a>
      );
    },
    blockquote({ children: c }) {
      return (
        <blockquote className="my-4 border-l-4 border-primary/40 bg-muted/30 px-4 py-2 italic text-muted-foreground">
          {c}
        </blockquote>
      );
    },
  };

  return (
    <div
      className={
        "prose prose-slate dark:prose-invert max-w-none " +
        // Headings: clear hierarchy and dividers under H1/H2
        "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground " +
        "prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-2 prose-h1:pb-2 prose-h1:border-b prose-h1:border-border " +
        "prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border/60 " +
        "prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-foreground/90 " +
        "prose-h4:text-base prose-h4:mt-4 prose-h4:mb-2 prose-h4:text-muted-foreground prose-h4:uppercase prose-h4:tracking-wide prose-h4:font-medium " +
        // Body
        "prose-p:leading-7 prose-p:text-foreground/90 " +
        "prose-strong:text-foreground prose-strong:font-semibold " +
        "prose-li:my-1 prose-li:text-foreground/90 " +
        // Code
        "prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-pre:my-3 " +
        "prose-code:before:content-[''] prose-code:after:content-[''] " +
        "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 " +
        "prose-code:font-mono prose-code:text-[0.85em] prose-code:text-foreground " +
        // Misc
        "prose-img:rounded-md prose-img:border " +
        "prose-hr:border-border prose-hr:my-6 " +
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline " +
        (className ?? "")
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={components}
      >
        {sanitize(children)}
      </ReactMarkdown>
    </div>
  );
}
