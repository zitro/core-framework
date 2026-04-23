"use client";

/**
 * VertexClassifyResult — read-only summary of an LLM classification, with
 * inline editors for path + filename so the user can override before save.
 */

import { Check, FileText, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface ClassifyState {
  dest_path: string;
  filename: string;
  rationale: string;
  confidence: number;
  sections_considered: string[];
}

interface ClassifyResultProps {
  state: ClassifyState;
  onChange: (next: ClassifyState) => void;
  preview: string;
}

export function VertexClassifyResult({ state, onChange, preview }: ClassifyResultProps) {
  const conf = Math.round(state.confidence * 100);
  const tone =
    conf >= 70
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : conf >= 40
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-rose-500/10 text-rose-700 dark:text-rose-300";

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-3.5" aria-hidden />
          Proposed destination
          <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>
            {conf}% confident
          </span>
        </div>
        <div className="grid grid-cols-[6.5rem_1fr] items-center gap-x-2 gap-y-2 text-sm">
          <label htmlFor="dest" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Pencil className="size-3" aria-hidden /> Folder
          </label>
          <Input
            id="dest"
            value={state.dest_path}
            onChange={(e) => onChange({ ...state, dest_path: e.target.value })}
            className="h-8 font-mono text-xs"
          />
          <label
            htmlFor="fname"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <FileText className="size-3" aria-hidden /> Filename
          </label>
          <Input
            id="fname"
            value={state.filename}
            onChange={(e) => onChange({ ...state, filename: e.target.value })}
            className="h-8 font-mono text-xs"
          />
        </div>
        {state.rationale && (
          <p className="mt-3 border-t pt-2 text-xs leading-relaxed text-muted-foreground">
            {state.rationale}
          </p>
        )}
      </div>

      {state.sections_considered.length > 0 && (
        <details className="rounded-md border bg-card/50 px-3 py-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Folders considered ({state.sections_considered.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {state.sections_considered.slice(0, 40).map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        </details>
      )}

      <details className="rounded-md border bg-card/50 px-3 py-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Preview (first 30 lines)</summary>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-snug text-foreground/80">
          {preview.split("\n").slice(0, 30).join("\n")}
        </pre>
      </details>
    </div>
  );
}
