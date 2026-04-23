"use client";

/**
 * Reports — saved view of artifacts intended for sharing with stakeholders.
 *
 * Filters the artifact catalog down to high-level outputs (story category +
 * executive-brief / deck-outline) and presents them as a clean reading list.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileBarChart2, Search } from "lucide-react";

import { ArtifactCard } from "@/components/synthesis/artifact-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { synthesisApi, type SynthesisArtifact } from "@/lib/api-synthesis";
import { useProject } from "@/stores/project-store";

const REPORT_TYPE_IDS = new Set([
  "executive-brief",
  "deck-outline",
  "story-arc",
  "narrative",
  "weekly-status",
  "wrap-up",
]);

function isReport(a: SynthesisArtifact): boolean {
  return a.category === "story" || REPORT_TYPE_IDS.has(a.type_id);
}

export default function ReportsPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? "";
  const [artifacts, setArtifacts] = useState<SynthesisArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

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

  const reports = useMemo(() => {
    let list = artifacts.filter(isReport);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.summary || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [artifacts, query]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <FileBarChart2 className="h-5 w-5 text-violet-500" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground">
              Stakeholder-ready outputs — narratives, executive briefs, and decks.
            </p>
          </div>
        </div>
        <div className="relative w-72 max-w-[40vw]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </header>

      {!projectId && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Pick a project in the sidebar to see its reports.
          </CardContent>
        </Card>
      )}

      {loading && projectId && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && projectId && reports.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">No reports yet</p>
            Generate a story-category artifact (executive brief, deck outline, narrative) from
            Synthesis to populate this view.
          </CardContent>
        </Card>
      )}

      {!loading && reports.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reports.map((a) => (
            <ArtifactCard
              key={a.id}
              artifact={a}
              onRegenerate={() => {}}
              onUpdate={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
