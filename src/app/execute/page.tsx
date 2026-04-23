"use client";

/**
 * /execute — top-level Artifacts page.
 *
 * Cross-category gallery of every generated artifact for the active
 * project, with filter chips and a search box. ?view=reports switches
 * to a denser report-style layout (groups by category, less chrome).
 * Companion to /refine, which is the build/curate surface; /execute is
 * the read-and-share view.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EyeOff, LayoutGrid, ListChecks, Search, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProject } from "@/stores/project-store";
import {
  synthesisApi,
  type SynthesisArtifact,
  type SynthesisCategoryId,
} from "@/lib/api-synthesis";
import { ENGAGEMENT_STATUS_LABELS, type EngagementStatus } from "@/types/fde";
import { ArtifactCard } from "@/components/synthesis/artifact-card";
import { ArtifactDetailModal } from "@/components/refine/artifact-detail-modal";
import { ReportsView } from "@/components/execute/reports-view";
import {
  CATEGORY_LABELS,
  EmptyHero,
  FilterChip,
  LATE_STAGE_CATEGORIES,
  SkeletonGrid,
  STATUS_STYLES,
  ViewToggle,
} from "@/components/execute/primitives";

type Filter = SynthesisCategoryId | "all";
type ViewMode = "gallery" | "reports";

export default function ArtifactsPage() {
  return (
    <Suspense fallback={null}>
      <ArtifactsInner />
    </Suspense>
  );
}

function ArtifactsInner() {
  const { activeProject } = useProject();
  const router = useRouter();
  const params = useSearchParams();
  const view: ViewMode = params.get("view") === "reports" ? "reports" : "gallery";
  const projectId = activeProject?.id ?? "";
  const status: EngagementStatus = activeProject?.status ?? "proposed";
  const isClosingStage = status === "completed" || status === "cancelled";
  const [artifacts, setArtifacts] = useState<SynthesisArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showLateStage, setShowLateStage] = useState(false);
  const [openArtifact, setOpenArtifact] = useState<SynthesisArtifact | null>(null);

  const setView = (next: ViewMode) => {
    const search = new URLSearchParams(params.toString());
    if (next === "reports") search.set("view", "reports");
    else search.delete("view");
    const qs = search.toString();
    router.replace(qs ? `/execute?${qs}` : "/execute", { scroll: false });
  };

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
          <div
            className="inline-flex rounded-md border bg-background p-0.5"
            role="tablist"
            aria-label="View mode"
          >
            <ViewToggle
              active={view === "gallery"}
              onClick={() => setView("gallery")}
              label="Gallery"
              icon={<LayoutGrid className="size-3.5" />}
            />
            <ViewToggle
              active={view === "reports"}
              onClick={() => setView("reports")}
              label="Reports"
              icon={<ListChecks className="size-3.5" />}
            />
          </div>
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
              : "Run synthesis from the Refine page to generate the first artifacts."
          }
        />
      ) : view === "reports" ? (
        <ReportsView
          artifacts={filtered}
          categoryLabels={CATEGORY_LABELS}
          onOpen={setOpenArtifact}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <ArtifactCard
              key={a.id}
              artifact={a}
              projectId={projectId}
              onRegenerate={() => {}}
              onOpenDetail={setOpenArtifact}
              onUpdate={(updated) =>
                setArtifacts((prev) =>
                  prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
                )
              }
            />
          ))}
        </div>
      )}
      <ArtifactDetailModal
        projectId={projectId}
        artifact={openArtifact}
        open={openArtifact !== null}
        onOpenChange={(o) => {
          if (!o) setOpenArtifact(null);
        }}
      />
    </div>
  );
}

