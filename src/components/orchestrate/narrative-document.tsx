"use client";

import { useState } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NarrativeResult {
  headline: string;
  summary: string;
  sections: Array<{ title: string; body: string }>;
  audience: string;
  style: string;
}

function asMarkdown(r: NarrativeResult): string {
  return [
    `# ${r.headline}`,
    "",
    r.summary,
    "",
    ...r.sections.flatMap((s) => [`## ${s.title}`, "", s.body, ""]),
  ].join("\n");
}

function asPlain(r: NarrativeResult): string {
  return [
    r.headline,
    "",
    r.summary,
    "",
    ...r.sections.flatMap((s) => [s.title, s.body, ""]),
  ].join("\n");
}

/** Article-style render of a generated narrative. Manrope display
 *  headline, muted summary, sectioned body at editorial line-height,
 *  paragraphs split on blank lines. Action footer: Copy MD / Copy
 *  text / Download .md / Regenerate. */
export function NarrativeDocument({
  result,
  discoveryName,
  onRegenerate,
  regenerating,
}: {
  result: NarrativeResult;
  discoveryName: string;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState<"plain" | "md" | null>(null);

  const copy = (text: string, kind: "plain" | "md") => {
    if (typeof navigator === "undefined") return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const download = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([asMarkdown(result)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${discoveryName.toLowerCase().replace(/\s+/g, "-") || "discovery"}-narrative.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article
      className={cn(
        "rounded-lg border bg-card animate-in fade-in-0 duration-200",
        "px-6 py-7 sm:px-9 sm:py-10",
      )}
    >
      <div className="mx-auto max-w-[65ch] space-y-7">
        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {result.audience}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {result.style}
            </span>
          </div>
          <h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {result.headline}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {result.summary}
          </p>
        </header>

        {result.sections.map((s, i) => (
          <section key={i} className="space-y-3">
            <h3 className="font-heading text-lg font-semibold tracking-tight">
              {s.title}
            </h3>
            <div className="space-y-3 text-[15px] leading-7 text-foreground/90">
              {s.body.split(/\n{2,}/).map((para, j) => (
                <p key={j} className="whitespace-pre-wrap">
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}

        <footer className="flex flex-wrap items-center gap-1.5 border-t border-border pt-6">
          <Button
            variant="outline"
            size="xs"
            onClick={() => copy(asMarkdown(result), "md")}
            aria-label="Copy as Markdown"
          >
            {copied === "md" ? (
              <Check className="h-3 w-3" aria-hidden />
            ) : (
              <Copy className="h-3 w-3" aria-hidden />
            )}
            Copy Markdown
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => copy(asPlain(result), "plain")}
            aria-label="Copy as plain text"
          >
            {copied === "plain" ? (
              <Check className="h-3 w-3" aria-hidden />
            ) : (
              <Copy className="h-3 w-3" aria-hidden />
            )}
            Copy text
          </Button>
          <Button variant="outline" size="xs" onClick={download}>
            <Download className="h-3 w-3" aria-hidden />
            Download .md
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onRegenerate}
            disabled={regenerating}
            className="ml-auto"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Regenerate
          </Button>
        </footer>
      </div>
    </article>
  );
}
