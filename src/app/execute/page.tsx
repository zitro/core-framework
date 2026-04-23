"use client";

/**
 * Top-level Artifacts page (v2.0).
 *
 * Cross-category gallery of every generated artifact for the active
 * project, with filter chips and a search box. Companion to /synthesis,
 * which is the build/curate surface; Artifacts is the read-and-share view.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { EyeOff, Search, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProject } from "@/stores/project-store";
import {
  synthesisApi,
  type SynthesisArtifact,
  type SynthesisCategoryId,
} from "@/lib/api-synthesis";
import { ENGAGEMENT_STATUS_LABELS, type EngagementStatus } from "@/types/fde";
import { ArtifactCard } from "@/components/synthesis/artifact-card";

const CATEGORY_LABELS: Record<SynthesisCategoryId, string> = {
  why: "Why",
  value: "Value",
  what: "What",
  scope: "Scope",
  how: "How",
  story: "Story",
  operational: "Operational",
};

/**
 * Categories that only make sense once an engagement is closing/closed
 * (wrap-ups, retros, status updates). Hidden by default until the project
 * status reaches `completed`; users can opt in via the "Show closing" toggle.
 */
const LATE_STAGE_CATEGORIES: ReadonlySet<SynthesisCategoryId> = new Set([
  "operational",
]);

const STATUS_STYLES: Record<EngagementStatus, string> = {
  proposed: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  active: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "border-slate-500/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  completed: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  cancelled: "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

type Filter = SynthesisCategoryId | "all";

export default function ArtifactsPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? "";
  const status: EngagementStatus = activeProject?.status ?? "proposed";
  const isClosingStage = status === "completed" || status === "cancelled";
  const [artifacts, setArtifacts] = useState<SynthesisArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showLateStage, setShowLateStage] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const a = await synthesisApi.artifacts(projectId);
      setArtifacts(a.artifacts);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Hide late-stage artifacts (operational: wrap-up, retro, status updates)
   * unless the engagement is in a closing stage or the user toggled "Show
   * closing". When the user explicitly picks the operational filter chip we
   * always show them so the chip count stays meaningful.
   */
  const stageVisible = useMemo(() => {
    const hideLate = !isClosingStage && !showLateStage && filter !== "operational";
    return hideLate
      ? artifacts.filter((a) => !LATE_STAGE_CATEGORIES.has(a.category))
      : artifacts;
  }, [artifacts, isClosingStage, showLateStage, filter]);

  const filtered = useMemo(() => {
    let list = stageVisible;
    if (filter !== "all") list = list.filter((a) => a.category === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.type_id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [stageVisible, filter, query]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: stageVisible.length };
    for (const a of stageVisible) out[a.category] = (out[a.category] ?? 0) + 1;
    return out;
  }, [stageVisible]);

  const hiddenLateCount = artifacts.length - stageVisible.length;

  if (!projectId) {
    return (
      <EmptyHero
        title="No project selected"
        body="Pick a project in the sidebar to see its artifacts."
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Artifacts</h1>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLES[status]}`}
              aria-label={`Project status ${ENGAGEMENT_STATUS_LABELS[status]}`}
            >
              {ENGAGEMENT_STATUS_LABELS[status]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {stageVisible.length} of {artifacts.length} for{" "}
            <span className="font-medium">{activeProject?.name}</span>
            {hiddenLateCount > 0 && (
              <>
                {" "}
                &middot;{" "}
                <button
                  type="button"
                  onClick={() => setShowLateStage((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                >
                  <EyeOff className="size-3" aria-hidden />
                  {showLateStage
                    ? `Hide ${hiddenLateCount} closing`
                    : `Show ${hiddenLateCount} closing`}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/refine";
            }}
          >
            <Wand2 className="size-3.5 mr-1.5" aria-hidden />
            Open Refine
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artifacts"
            className="pl-8"
            aria-label="Search artifacts"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`All (${counts.all ?? 0})`}
          />
          {(Object.keys(CATEGORY_LABELS) as SynthesisCategoryId[]).map((cat) => (
            <FilterChip
              key={cat}
              active={filter === cat}
              onClick={() => setFilter(cat)}
              label={`${CATEGORY_LABELS[cat]} (${counts[cat] ?? 0})`}
            />
          ))}
        </div>
      </div>

      {loading && artifacts.length === 0 ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyHero
          title={query || filter !== "all" ? "No matches" : "No artifacts yet"}
          body={
            query || filter !== "all"
              ? "Try clearing the filters or search."
              : "Run synthesis from the Synthesis page to generate the first artifacts."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <ArtifactCard
              key={a.id}
              artifact={a}
              onRegenerate={() => {}}
              onUpdate={(updated) =>
                setArtifacts((prev) =>
                  prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
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

function SkeletonGrid() {
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

function EmptyHero({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Badge variant="outline">v2.0</Badge>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
