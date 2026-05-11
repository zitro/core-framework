"use client";

/**
 * ArtifactDetailView — recursive renderer for an artifact's body JSON.
 *
 * Split out of ArtifactDetailModal so the modal shell stays focused on
 * layout + tabs. Renders the summary, body fields (lists/objects
 * recursed), and the citation list at the bottom. Pure presentation,
 * no API calls.
 */

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StoryboardFrames } from "@/components/synthesis/storyboard-frames";
import type { SynthesisArtifact } from "@/types/synthesis";

interface Props {
  artifact: SynthesisArtifact;
  loading?: boolean;
  onArtifactUpdate?: (artifact: SynthesisArtifact) => void;
}

export function ArtifactDetailView({ artifact, loading, onArtifactUpdate }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  const entries = Object.entries(artifact.body || {}).filter(
    // The storyboard component renders ``frames`` (and supporting fields)
    // itself; suppress them from the generic body so we don't double-render.
    ([k]) =>
      artifact.type_id !== "storyboard" ||
      !["frames", "persona", "takeaway"].includes(k),
  );
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4 pt-2">
        {artifact.summary && (
          <p className="text-sm leading-relaxed">{artifact.summary}</p>
        )}
        {artifact.type_id === "storyboard" && (
          <StoryboardFrames
            artifact={artifact}
            onUpdate={(updated) => onArtifactUpdate?.(updated)}
          />
        )}
        {entries.length > 0 && (
          <dl className="space-y-3 text-sm">
            {entries.map(([k, v]) => (
              <div key={k} className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd>{renderBody(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {artifact.citations.length > 0 && (
          <section className="space-y-2 border-t border-border pt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Citations
            </h3>
            <ul className="space-y-1.5 text-xs">
              {artifact.citations.map((c, i) => (
                <li key={i}>
                  <code className="text-xs">{c.source_id}</code>
                  {c.quote && (
                    <span className="text-muted-foreground">
                      {" "}
                      — &ldquo;{c.quote}&rdquo;
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}

function renderBody(value: unknown): ReactNode {
  if (value == null || value === "") {
    return <em className="text-muted-foreground">empty</em>;
  }
  if (typeof value === "boolean") {
    return (
      <Badge
        variant={value ? "default" : "secondary"}
        className="text-[10px]"
      >
        {value ? "yes" : "no"}
      </Badge>
    );
  }
  if (typeof value === "number") {
    return <span className="tabular-nums">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <em className="text-muted-foreground">empty</em>;
    }
    const allPrimitive = value.every(
      (v) =>
        v == null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean",
    );
    if (allPrimitive) {
      return (
        <ul className="list-disc space-y-1 pl-5">
          {value.map((v, i) => (
            <li key={i}>{renderBody(v)}</li>
          ))}
        </ul>
      );
    }
    return (
      <ol className="space-y-3">
        {value.map((v, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-muted/30 p-3"
          >
            {renderBody(v)}
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return <em className="text-muted-foreground">empty</em>;
    }
    return (
      <dl className="space-y-2">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-3"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {humanizeKey(k)}
            </dt>
            <dd className="min-w-0 text-sm">{renderBody(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (typeof value === "string" && value.length > 200) {
    return <p className="whitespace-pre-wrap leading-relaxed">{value}</p>;
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
