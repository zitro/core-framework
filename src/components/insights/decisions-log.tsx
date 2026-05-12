"use client";

/**
 * DecisionsLog — chronological list of captured decisions.
 *
 * Purpose: persistent record of "we decided X". Pulls every evidence
 * row tagged ``decision`` (the Decision capture type from Capture's
 * Context tab). Newest first; phase + source surface for context.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { request } from "@/lib/http";

interface Decision {
  id: string;
  text: string;
  source: string;
  phase: string;
  rationale: string;
  tags: string[];
  created_at: string;
}

interface DecisionsResponse {
  decisions: Decision[];
  total: number;
}

interface Props {
  discoveryId: string;
}

export function DecisionsLog({ discoveryId }: Props) {
  const [data, setData] = useState<DecisionsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(discoveryId));
  const [error, setError] = useState<string | null>(null);
  const [trackedId, setTrackedId] = useState(discoveryId);
  if (trackedId !== discoveryId) {
    setTrackedId(discoveryId);
    setLoading(Boolean(discoveryId));
  }

  useEffect(() => {
    if (!discoveryId) return;
    let cancelled = false;
    request<DecisionsResponse>(
      `/api/insights/decisions?discovery_id=${encodeURIComponent(discoveryId)}`,
    )
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load decisions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryId]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading decisions…
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  if (data.total === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No decisions captured yet. Use Capture → Context → <span className="font-medium">Decision</span> to log one.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {data.total} decision{data.total === 1 ? "" : "s"} captured
      </p>
      <ul className="space-y-2">
        {data.decisions.map((d) => (
          <li
            key={d.id}
            className="group rounded-md border bg-card px-3 py-2.5 transition-colors hover:border-brand/40"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm leading-relaxed">{d.text}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  {d.phase && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {d.phase}
                    </Badge>
                  )}
                  {d.source && <span>· {d.source}</span>}
                  <span>· {formatDate(d.created_at)}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}
