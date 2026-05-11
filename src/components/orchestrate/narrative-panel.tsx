"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  Download,
  RefreshCw,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Discovery } from "@/types/core";

type Audience = "executive" | "technical" | "customer" | "internal";
type Style = "narrative" | "brief" | "outline";

const AUDIENCES: { value: Audience; label: string; tagline: string }[] = [
  { value: "executive", label: "Executive", tagline: "Decision-ready, brief, outcome-led" },
  { value: "customer", label: "Customer", tagline: "Their language, their stakes" },
  { value: "technical", label: "Technical", tagline: "Architecture, risks, hand-off detail" },
  { value: "internal", label: "Internal", tagline: "Team-facing, candid, in-progress" },
];

const STYLES: { value: Style; label: string; tagline: string }[] = [
  { value: "narrative", label: "Narrative", tagline: "Continuous prose, story arc" },
  { value: "brief", label: "Brief", tagline: "Tight, scannable sections" },
  { value: "outline", label: "Outline", tagline: "Headlines + bullets" },
];

interface NarrativeResult {
  headline: string;
  summary: string;
  sections: Array<{ title: string; body: string }>;
  audience: string;
  style: string;
}

export function NarrativePanel({ discovery }: { discovery: Discovery }) {
  const [audience, setAudience] = useState<Audience>("internal");
  const [style, setStyle] = useState<Style>("narrative");
  const [focus, setFocus] = useState("");
  const [focusOpen, setFocusOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"plain" | "md" | null>(null);
  const focusRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusOpen) focusRef.current?.focus();
  }, [focusOpen]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.narrative.generate({
        discovery_id: discovery.id,
        audience,
        style,
        focus: focus.trim(),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate narrative");
    } finally {
      setLoading(false);
    }
  };

  const asMarkdown = (r: NarrativeResult) =>
    [
      `# ${r.headline}`,
      "",
      r.summary,
      "",
      ...r.sections.flatMap((s) => [`## ${s.title}`, "", s.body, ""]),
    ].join("\n");

  const asPlain = (r: NarrativeResult) =>
    [
      r.headline,
      "",
      r.summary,
      "",
      ...r.sections.flatMap((s) => [s.title, s.body, ""]),
    ].join("\n");

  const copy = (text: string, kind: "plain" | "md") => {
    if (typeof navigator === "undefined") return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const download = (r: NarrativeResult) => {
    if (typeof window === "undefined") return;
    const blob = new Blob([asMarkdown(r)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${discovery.name.toLowerCase().replace(/\s+/g, "-") || "discovery"}-narrative.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-lg border bg-card">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <ToggleRow
            label="Audience"
            options={AUDIENCES}
            value={audience}
            onChange={(v) => setAudience(v as Audience)}
          />
          <ToggleRow
            label="Style"
            options={STYLES}
            value={style}
            onChange={(v) => setStyle(v as Style)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setFocusOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={focusOpen}
          >
            {focusOpen ? (
              <X className="h-3 w-3" aria-hidden />
            ) : (
              <Pencil className="h-3 w-3" aria-hidden />
            )}
            {focusOpen
              ? "Hide focus"
              : focus.trim()
                ? "Edit focus"
                : "Add focus (optional)"}
            {!focusOpen && focus.trim() && (
              <span className="ml-1 max-w-[16rem] truncate text-foreground/80">
                — {focus.trim()}
              </span>
            )}
          </button>
          <Button onClick={generate} disabled={loading} size="sm">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Generating
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {result ? "Regenerate" : "Generate"}
              </>
            )}
          </Button>
        </div>

        {focusOpen && (
          <div className="border-t border-border bg-muted/30 p-4">
            <Textarea
              ref={focusRef}
              placeholder='Bias the story (e.g. "lead with cost-to-serve risk")'
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              maxLength={1000}
              className="min-h-16 bg-background"
              rows={2}
            />
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {focus.length} / 1000
            </p>
          </div>
        )}
      </div>

      {/* Document */}
      {loading && <NarrativeSkeleton />}

      {!loading && error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && !result && (
        <EmptyState
          icon={Sparkles}
          title="See your discovery as a story"
          description="The narrative pulls the latest evidence, problem statement, and use cases into a continuous read. Regenerate any time the underlying state changes."
        />
      )}

      {!loading && result && (
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
              <Button
                variant="outline"
                size="xs"
                onClick={() => download(result)}
              >
                <Download className="h-3 w-3" aria-hidden />
                Download .md
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={generate}
                disabled={loading}
                className="ml-auto"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Regenerate
              </Button>
            </footer>
          </div>
        </article>
      )}
    </div>
  );
}

function ToggleRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; tagline: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.tagline}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              value === opt.value
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {options.find((o) => o.value === value)?.tagline}
      </p>
    </div>
  );
}

function NarrativeSkeleton() {
  return (
    <div
      className="rounded-lg border bg-card px-6 py-7 sm:px-9 sm:py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-[65ch] space-y-7">
        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/4 sm:h-8" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </header>
        {[1, 2, 3].map((i) => (
          <section key={i} className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[97%]" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-3/4" />
          </section>
        ))}
      </div>
    </div>
  );
}
