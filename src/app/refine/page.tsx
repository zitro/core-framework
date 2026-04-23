"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wand2, AlertCircle, FileText, Presentation, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Layers } from "lucide-react";
import { useProject } from "@/stores/project-store";
import {
  synthesisApi,
  type SynthesisArtifact,
  type SynthesisCatalog,
  type SynthesisQuestion,
  type SynthesisSources,
} from "@/lib/api-synthesis";
import { ArtifactCard } from "@/components/synthesis/artifact-card";
import { EmptyArtifactCard } from "@/components/synthesis/empty-artifact-card";
import { ArtifactDetailModal } from "@/components/refine/artifact-detail-modal";
import { CompassPanel } from "@/components/synthesis/compass-panel";
import { ConnectorsPanel } from "@/components/synthesis/connectors-panel";
import { QuestionsPanel } from "@/components/synthesis/questions-panel";
import { SignalsPanel } from "@/components/synthesis/signals-panel";
import { SourcesPanel } from "@/components/synthesis/sources-panel";
import { VertexWriteBackToggle } from "@/components/synthesis/vertex-toggle";
import { engagementsApi } from "@/lib/api-fde";
import { downloadFile } from "@/lib/http";

export default function SynthesisPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? "";

  const [catalog, setCatalog] = useState<SynthesisCatalog | null>(null);
  const [artifacts, setArtifacts] = useState<SynthesisArtifact[]>([]);
  const [sources, setSources] = useState<SynthesisSources | null>(null);
  const [questions, setQuestions] = useState<SynthesisQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [busyTypeId, setBusyTypeId] = useState<string | null>(null);
  const [vertexEnabled, setVertexEnabled] = useState(false);
  const [autoRebuild, setAutoRebuild] = useState(false);
  const [openArtifact, setOpenArtifact] = useState<SynthesisArtifact | null>(null);

  const loadAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [c, a, s, q, p] = await Promise.all([
        synthesisApi.catalog(),
        synthesisApi.artifacts(projectId),
        synthesisApi.sources(projectId).catch(() => null),
        synthesisApi.questions(projectId),
        engagementsApi
          .get(projectId)
          .catch(() => null),
      ]);
      setCatalog(c);
      setArtifacts(a.artifacts);
      setSources(s);
      setQuestions(q.questions);
      // Default vertex write-back ON when a repo is connected and the user
      // hasn't explicitly opted out.
      const project = p as {
        repo_path?: string;
        metadata?: { vertex?: { write_enabled?: boolean }; auto_rebuild?: boolean };
      } | null;
      const explicit = project?.metadata?.vertex?.write_enabled;
      const hasRepo = !!project?.repo_path;
      setVertexEnabled(explicit ?? hasRepo);
      const ar = ((p as { metadata?: { auto_rebuild?: boolean } } | null)
        ?.metadata?.auto_rebuild) ?? false;
      setAutoRebuild(!!ar);
    } catch (err) {
      toast.error(`Failed to load synthesis: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const artifactsByCategory = useMemo(() => {
    const map: Record<string, SynthesisArtifact[]> = {};
    for (const a of artifacts) {
      (map[a.category] ??= []).push(a);
    }
    return map;
  }, [artifacts]);

  const onSynthesize = async () => {
    if (!projectId) return;
    setSynthesizing(true);
    try {
      const res = await synthesisApi.synthesize(projectId);
      toast.success(
        `Generated ${res.artifact_count} artifacts from ${res.corpus_doc_count} sources`,
      );
      if (res.failures.length > 0) {
        toast.warning(`${res.failures.length} type(s) failed — see logs`);
      }
      await loadAll();
    } catch (err) {
      toast.error(`Synthesize failed: ${(err as Error).message}`);
    } finally {
      setSynthesizing(false);
    }
  };

  const onRegenerate = async (typeId: string) => {
    if (!projectId) return;
    setBusyTypeId(typeId);
    try {
      await synthesisApi.regenerate(projectId, typeId);
      toast.success(`Regenerated ${typeId}`);
      await loadAll();
    } catch (err) {
      toast.error(`Regenerate failed: ${(err as Error).message}`);
    } finally {
      setBusyTypeId(null);
    }
  };

  const onRefreshQuestions = async () => {
    if (!projectId) return;
    try {
      const res = await synthesisApi.refreshQuestions(projectId);
      setQuestions(res.questions);
      toast.success(`Generated ${res.questions.length} questions`);
    } catch (err) {
      toast.error(`Question refresh failed: ${(err as Error).message}`);
    }
  };

  const onWriteBackVertex = async () => {
    if (!projectId) return;
    try {
      const res = await synthesisApi.writebackVertex(projectId);
      if (!res.enabled) {
        toast.warning(
          "Vertex write-back is OFF. Toggle it on, then try again.",
        );
        return;
      }
      if (res.errors.length > 0) {
        const first = res.errors[0];
        toast.error(
          `Push failed: ${first}${res.errors.length > 1 ? ` (+${res.errors.length - 1} more)` : ""}`,
        );
        return;
      }
      if (res.written.length === 0) {
        toast.info("Nothing to push \u2014 generate or update artifacts first.");
        return;
      }
      toast.success(
        `Pushed ${res.written.length} file${res.written.length === 1 ? "" : "s"} to vertex`,
      );
    } catch (err) {
      toast.error(`Write-back failed: ${(err as Error).message}`);
    }
  };

  const hasArtifacts = artifacts.length > 0;

  if (!projectId) {
    return (
      <main className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" />
              No active project
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pick a project from the switcher in the sidebar to see its
            synthesis.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Synthesis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeProject?.name} ·{" "}
            {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"} ·{" "}
            {sources?.doc_count ?? 0} source
            {(sources?.doc_count ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasArtifacts}
            onClick={() =>
              void downloadFile(
                synthesisApi.exportDocxUrl(projectId),
                `${activeProject?.slug ?? projectId}-synthesis.docx`,
              )
            }
          >
            <FileText className="size-4 mr-2" />
            .docx
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasArtifacts}
            onClick={() =>
              void downloadFile(
                synthesisApi.exportPptxUrl(projectId),
                `${activeProject?.slug ?? projectId}-synthesis.pptx`,
              )
            }
          >
            <Presentation className="size-4 mr-2" />
            .pptx
          </Button>
          <VertexWriteBackToggle
            projectId={projectId}
            enabled={vertexEnabled}
            onChange={setVertexEnabled}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={onWriteBackVertex}
            disabled={!hasArtifacts}
            title="Push artifacts as markdown into the connected vertex repo"
          >
            <UploadCloud className="size-4 mr-2" />
            Push to vertex
          </Button>
          <Button onClick={onSynthesize} disabled={synthesizing || loading}>
            <Wand2 className="size-4 mr-2" />
            {hasArtifacts ? "Resynthesize" : "Synthesize project"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Tabs defaultValue="artifacts">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="artifacts" className="gap-1.5">
                <Layers className="size-3.5" aria-hidden /> Artifacts
                {hasArtifacts && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {artifacts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="questions" className="gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" aria-hidden /> Questions
                {questions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {questions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="mt-4 space-y-4">
              <QuestionsPanel
                questions={questions}
                onRefresh={onRefreshQuestions}
                busy={loading}
              />
            </TabsContent>

            <TabsContent value="artifacts" className="mt-4 space-y-6">
          {!catalog || loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading…
              </CardContent>
            </Card>
          ) : artifacts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No artifacts yet. Click <strong>Synthesize project</strong> to
                build the first cut.
              </CardContent>
            </Card>
          ) : (
            catalog.categories.map((cat) => {
              const items = artifactsByCategory[cat.id] ?? [];
              const byTypeId = new Map(items.map((a) => [a.type_id, a] as const));
              const labelByTypeId = new Map(cat.types.map((t) => [t.id, t.label] as const));
              const descByTypeId = new Map(
                cat.types.map((t) => [t.id, t.description ?? ""] as const),
              );
              // Render every catalog type as a slot, even when not yet
              // generated — so nothing stays hidden behind synthesize.
              return (
                <section key={cat.id} className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-lg font-semibold">{cat.label}</h2>
                    <Badge variant="outline">
                      {items.length}/{cat.types.length}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {cat.description}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {cat.types.map((t) => {
                      const a = byTypeId.get(t.id);
                      if (a) {
                        return (
                          <ArtifactCard
                            key={t.id}
                            artifact={a}
                            projectId={projectId}
                            typeLabel={labelByTypeId.get(a.type_id)}
                            onRegenerate={onRegenerate}
                            onItemAdded={loadAll}
                            onUpdate={(updated) =>
                              setArtifacts((prev) =>
                                prev.map((p) =>
                                  p.id === updated.id ? { ...p, ...updated } : p,
                                ),
                              )
                            }
                            onOpenDetail={setOpenArtifact}
                            busy={busyTypeId === a.type_id}
                          />
                        );
                      }
                      return (
                        <EmptyArtifactCard
                          key={t.id}
                          typeId={t.id}
                          typeLabel={t.label}
                          description={descByTypeId.get(t.id)}
                          busy={busyTypeId === t.id}
                          onGenerate={async (typeId) => {
                            await onRegenerate(typeId);
                            await loadAll();
                          }}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}

          {/* Sources & connectors — less prominent, collapsible */}
          {hasArtifacts && (
            <section className="space-y-3 border-t pt-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Sources & connectors</h2>
                <p className="text-xs text-muted-foreground">
                  The corpus feeding synthesis. Add connectors (GitHub, web,
                  HTTP JSON) to enrich what the AI can ground against.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SourcesPanel sources={sources} />
                <ConnectorsPanel projectId={projectId} />
              </div>
            </section>
          )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <CompassPanel
            projectId={projectId}
            refreshKey={artifacts.length}
            autoRebuild={autoRebuild}
            onToggleAutoRebuild={async (enabled) => {
              try {
                const res = await synthesisApi.updateOperationalSettings(
                  projectId,
                  enabled,
                );
                setAutoRebuild(res.auto_rebuild);
              } catch (err) {
                toast.error(`Failed to update setting: ${(err as Error).message}`);
              }
            }}
            onRefreshSources={async () => {
              try {
                const res = await synthesisApi.refreshSources(projectId);
                if (res.regenerated.length > 0) {
                  toast.success(
                    `Refreshed ${res.source_count} sources, regenerated ${res.regenerated.length} artifact(s)`,
                  );
                  await loadAll();
                } else {
                  toast.success(`Refreshed ${res.source_count} sources`);
                }
              } catch (err) {
                toast.error(`Refresh failed: ${(err as Error).message}`);
              }
            }}
          />
          <SignalsPanel
            projectId={projectId}
            onRegenerate={onRegenerate}
            refreshKey={artifacts.length}
          />
        </aside>
      </div>
      <ArtifactDetailModal
        projectId={projectId}
        artifact={openArtifact}
        open={openArtifact !== null}
        onOpenChange={(o) => {
          if (!o) setOpenArtifact(null);
        }}
        onRegenerated={() => void loadAll()}
      />
    </main>
  );
}
