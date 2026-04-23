"use client";

/**
 * Small UI primitives for /execute: filter chips, view toggle button,
 * skeleton grid, and an empty-state hero. Pulled out so the page itself
 * stays under the 300-line cap.
 */

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SynthesisCategoryId } from "@/lib/api-synthesis";
import type { EngagementStatus } from "@/types/fde";

export const CATEGORY_LABELS: Record<SynthesisCategoryId, string> = {
  why: "Why",
  value: "Value",
  what: "What",
  scope: "Scope",
  how: "How",
  story: "Story",
  operational: "Operational",
};

export const LATE_STAGE_CATEGORIES: ReadonlySet<SynthesisCategoryId> = new Set([
  "operational",
]);

export const STATUS_STYLES: Record<EngagementStatus, string> = {
  proposed: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  active: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "border-slate-500/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  completed: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  cancelled: "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center rounded-full border px-3 py-1 text-xs transition " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-accent")
      }
    >
      {label}
    </button>
  );
}

export function ViewToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      {label}
    </button>
  );
}

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} aria-hidden>
          <CardContent className="space-y-2 py-6">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EmptyHero({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Badge variant="outline">v2.2</Badge>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
