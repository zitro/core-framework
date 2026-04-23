"use client";

/**
 * Renders the dry-run output of POST /api/capture/{project_id}/extract-classify.
 *
 * Shows: an at-a-glance diff banner (creates/replaces), each candidate
 * card with type, action, summary, and the vertex projection path
 * preview, plus an evidence excerpt the LLM highlighted.
 *
 * Persistence is downstream (regenerate / write-back). This component
 * is presentation-only — the only mutation is "Discard & start over".
 */

import { Check, FilePenLine, FilePlus2, FolderOpen, Quote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { api } from "@/lib/api";

type Result = Awaited<ReturnType<typeof api.capture.extractClassify>>;

interface ExtractResultsProps {
  result: Result;
  sourceLabel: string;
  onDiscard: () => void;
}

export function ExtractResults({ result, sourceLabel, onDiscard }: ExtractResultsProps) {
  const { candidates, db_diff, vertex_paths } = result;
  const total = candidates.length;
  const pathByIndex = new Map<number, Result["vertex_paths"][number]>();
  for (const p of vertex_paths) pathByIndex.set(p.candidate_index, p);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-xs uppercase tracking-wide">
              {sourceLabel}
            </Badge>
            <CardTitle className="text-base">Dry-run results</CardTitle>
          </div>
          <CardDescription>
            {total === 0 ? (
              <>The model didn&apos;t find any artifact-shaped content. Try giving it more context.</>
            ) : (
              <>
                {total} candidate{total === 1 ? "" : "s"} — {db_diff.creates} new and{" "}
                {db_diff.replaces} would replace existing artifacts. Nothing has been saved yet.
              </>
            )}
          </CardDescription>
        </CardHeader>
        {total > 0 && (
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button variant="default" disabled title="Phase D3 wires acceptance">
              <Check className="mr-2 h-4 w-4" aria-hidden />
              Accept all
            </Button>
            <Button variant="ghost" onClick={onDiscard}>
              Discard & start over
            </Button>
            <span className="text-xs text-muted-foreground">
              Acceptance lands in the next phase — for now this is a preview.
            </span>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {candidates.map((c, idx) => {
          const path = pathByIndex.get(idx);
          const isReplace = c.action === "replace";
          return (
            <Card key={`${c.type_id}-${idx}`} className="flex flex-col">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isReplace ? (
                        <FilePenLine className="h-4 w-4 text-amber-500" aria-hidden />
                      ) : (
                        <FilePlus2 className="h-4 w-4 text-emerald-500" aria-hidden />
                      )}
                      <Badge variant={isReplace ? "secondary" : "default"} className="text-[10px]">
                        {isReplace ? "REPLACE" : "NEW"}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {c.type_id}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm leading-tight">{c.title}</CardTitle>
                    <CardDescription className="text-xs">{c.category}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                {c.summary && <p className="text-muted-foreground">{c.summary}</p>}
                {c.evidence_quote && (
                  <blockquote className="flex gap-2 rounded-md border-l-2 border-primary/40 bg-muted/30 p-2 text-xs italic text-muted-foreground">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    <span>{c.evidence_quote}</span>
                  </blockquote>
                )}
                <div className="mt-auto rounded-md border border-dashed bg-muted/20 p-2 text-xs">
                  {path?.available ? (
                    <div className="flex items-start gap-2">
                      <FolderOpen
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <code className="break-all font-mono text-[11px]">
                        {path.relative_path || path.path}
                      </code>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Vertex projection unavailable: {path?.reason || "no writable source"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
