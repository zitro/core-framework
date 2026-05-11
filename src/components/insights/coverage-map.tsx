"use client";

/**
 * CoverageMap — visual grid of (phase × artifact type) → count.
 *
 * Purpose: one-glance answer to "what's thin in this discovery?" Cells
 * colored by status: brand for ok, muted for draft, dashed for missing.
 * Hovering a cell shows the count; clicking jumps to the surface that
 * owns that data (best-effort).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { insightsApi, type CoverageCell, type CoverageResponse, type InsightPhase } from "@/lib/api-insights";

interface Props {
  discoveryId: string;
}

const PHASE_LABEL: Record<InsightPhase, string> = {
  capture: "Capture",
  orchestrate: "Orchestrate",
  refine: "Refine",
  execute: "Execute",
};

// Best-effort jump target per phase.
const PHASE_HREF: Record<InsightPhase, string> = {
  capture: "/capture",
  orchestrate: "/orchestrate",
  refine: "/refine",
  execute: "/execute",
};

export function CoverageMap({ discoveryId }: Props) {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!discoveryId) return;
    let cancelled = false;
    setLoading(true);
    insightsApi
      .coverage(discoveryId)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load coverage");
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
        Loading coverage…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data) return null;

  const cellsByPhase = data.phases.map((phase) => ({
    phase,
    cells: data.cells.filter((c) => c.phase === phase),
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.phases.map((phase) => (
          <Link
            key={phase}
            href={PHASE_HREF[phase]}
            className="group flex items-center justify-between rounded-md border bg-card px-3 py-2 transition-colors hover:border-brand/40"
          >
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {PHASE_LABEL[phase]}
              </p>
              <p className="font-heading text-2xl font-semibold tabular-nums leading-none">
                {data.totals[phase] ?? 0}
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-brand">
              open →
            </span>
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {cellsByPhase.map(({ phase, cells }) => (
          <section key={phase} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-heading text-sm font-semibold tracking-tight">
                {PHASE_LABEL[phase]}
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {cells.length} item type{cells.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {cells.map((cell) => (
                <CoverageTile key={cell.type_id} cell={cell} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CoverageTile({ cell }: { cell: CoverageCell }) {
  const tone =
    cell.status === "ok"
      ? "border-brand/40 bg-brand/5"
      : cell.status === "draft"
        ? "border-border bg-muted/30"
        : "border-dashed border-muted bg-transparent";
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${tone}`}>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{cell.label}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {cell.status === "missing" ? "Missing" : cell.status === "draft" ? "Draft" : "Captured"}
        </p>
      </div>
      <p className="font-heading text-lg font-semibold tabular-nums">{cell.count}</p>
    </div>
  );
}
