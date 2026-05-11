"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/layout/empty-state";
import { api } from "@/lib/api";
import type { Discovery } from "@/types/core";

import { NarrativeDocument, type NarrativeResult } from "@/components/orchestrate/narrative-document";
import { NarrativeSkeleton } from "@/components/orchestrate/narrative-skeleton";
import { ToggleRow, type ToggleOption } from "@/components/orchestrate/narrative-toggle-row";

type Audience = "executive" | "technical" | "customer" | "internal";
type Style = "narrative" | "brief" | "outline";

const AUDIENCES: ToggleOption<Audience>[] = [
  { value: "executive", label: "Executive", tagline: "Decision-ready, brief, outcome-led" },
  { value: "customer", label: "Customer", tagline: "Their language, their stakes" },
  { value: "technical", label: "Technical", tagline: "Architecture, risks, hand-off detail" },
  { value: "internal", label: "Internal", tagline: "Team-facing, candid, in-progress" },
];

const STYLES: ToggleOption<Style>[] = [
  { value: "narrative", label: "Narrative", tagline: "Continuous prose, story arc" },
  { value: "brief", label: "Brief", tagline: "Tight, scannable sections" },
  { value: "outline", label: "Outline", tagline: "Headlines + bullets" },
];

export function NarrativePanel({ discovery }: { discovery: Discovery }) {
  const [audience, setAudience] = useState<Audience>("internal");
  const [style, setStyle] = useState<Style>("narrative");
  const [focus, setFocus] = useState("");
  const [focusOpen, setFocusOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        <NarrativeDocument
          result={result}
          discoveryName={discovery.name}
          onRegenerate={generate}
          regenerating={loading}
        />
      )}
    </div>
  );
}
