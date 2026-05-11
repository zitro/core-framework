"use client";

/**
 * GroundedPanel — search-grounded Q&A with inline citations.
 *
 * Lifted from the deleted ``/grounding`` route. Ask a question, get an
 * answer + follow-ups + citation list backed by M365 Graph search.
 */

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask a question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. What is Contoso's stated strategy for AI?"
            rows={3}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button size="sm" onClick={() => void ask()} disabled={busy || !q.trim()}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Grounding…
              </>
            ) : (
              "Ask"
            )}
          </Button>
        </CardContent>
      </Card>

      {resp && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Answer</CardTitle>
              <Badge variant="outline" className="capitalize">
                Confidence: {resp.result.confidence}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap">{resp.result.answer}</p>

            {resp.result.follow_ups?.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Follow-ups
                </h3>
                <ul className="list-disc space-y-0.5 pl-5">
                  {resp.result.follow_ups.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Citations
              </h3>
              <ul className="space-y-1 text-xs">
                {resp.snippets.map((s) => (
                  <li key={s.index}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      [{s.index}] {s.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
