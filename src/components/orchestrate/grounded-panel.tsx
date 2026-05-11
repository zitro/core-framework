"use client";

/**
 * GroundedPanel — fast, search-grounded answer with citations.
 *
 * Purpose: one-shot lookup. The user has a specific factual question
 * about the customer/space and wants an answer they can trust + cite.
 * No threading, no iteration loop here — that's what Narrative and the
 * AiFeedback widget are for.
 */

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { m365Api, type GroundingResponse } from "@/lib/api-m365";

interface Props {
  discoveryId?: string;
}

export function GroundedPanel({ discoveryId }: Props = {}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<GroundingResponse | null>(null);

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setResp(await m365Api.ground(q, 6, discoveryId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Question
        </label>
        <Textarea
          placeholder="e.g. What is Contoso's stated strategy for AI?"
          rows={3}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (!busy && q.trim()) void ask();
            }
          }}
          className="resize-y text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            <kbd className="rounded border bg-muted/60 px-1 font-mono text-[9px]">⌘</kbd>
            <span className="mx-0.5">+</span>
            <kbd className="rounded border bg-muted/60 px-1 font-mono text-[9px]">Enter</kbd> to ask
          </span>
          <Button type="submit" size="sm" disabled={busy || !q.trim()}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Grounding…
              </>
            ) : (
              "Ask"
            )}
          </Button>
        </div>
      </form>

      {resp && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Answer
            </p>
            <Badge variant="outline" className="text-[10px] capitalize">
              Confidence: {resp.result.confidence}
            </Badge>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-relaxed">{resp.result.answer}</p>

          {resp.result.follow_ups?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Follow-ups
              </p>
              <ul className="space-y-0.5">
                {resp.result.follow_ups.map((f, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-muted py-0.5 pl-2.5 text-xs leading-relaxed text-foreground/85"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resp.snippets.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Citations
              </p>
              <ul className="space-y-0.5">
                {resp.snippets.map((s) => (
                  <li key={s.index} className="text-xs">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-foreground/85 hover:text-brand hover:underline"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground">
                        [{s.index}]
                      </span>
                      {s.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
