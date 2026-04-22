"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wand2, AlertCircle, FileText, Presentation, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/stores/project-store";
import {
  synthesisApi,
  type SynthesisArtifact,
  type SynthesisCatalog,
  type SynthesisQuestion,
  type SynthesisSources,
} from "@/lib/api-synthesis";
import { ArtifactCard } from "@/components/synthesis/artifact-card";
import { ChatPanel } from "@/components/synthesis/chat-panel";
import { CompassPanel } from "@/components/synthesis/compass-panel";
import { ConnectorsPanel } from "@/components/synthesis/connectors-panel";
import { QuestionsPanel } from "@/components/synthesis/questions-panel";
import { SignalsPanel } from "@/components/synthesis/signals-panel";
import { SourcesPanel } from "@/components/synthesis/sources-panel";
import { VertexWriteBackToggle } from "@/components/synthesis/vertex-toggle";
import { engagementsApi } from "@/lib/api-fde";

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
          "Vertex write-back disabled. Set metadata.vertex.write_enabled=true on the project.",
        );
        return;
      }
      if (res.errors.length > 0) {
        toast.error(`Write-back: ${res.errors.length} error(s) — wrote ${res.written.length}`);
      } else {
        toast.success(`Pushed ${res.written.length} file(s) to vertex`);
      }
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
    <main className="container mx-auto p-6 max-w-6xl space-y-6">
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
            onClick={() => window.open(synthesisApi.exportDocxUrl(projectId), "_blank")}
          >
            <FileText className="size-4 mr-2" />
            .docx
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasArtifacts}
            onClick={() => window.open(synthesisApi.exportPptxUrl(projectId), "_blank")}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
              if (items.length === 0) return null;
              return (
                <section key={cat.id} className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-lg font-semibold">{cat.label}</h2>
                    <Badge variant="outline">{items.length}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {cat.description}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((a) => (
                      <ArtifactCard
                        key={a.id}
                        artifact={a}
                        onRegenerate={onRegenerate}
                        busy={busyTypeId === a.type_id}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <aside className="space-y-6">
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
          <ChatPanel projectId={projectId} />
          <ConnectorsPanel projectId={projectId} />
          <QuestionsPanel
            questions={questions}
            onRefresh={onRefreshQuestions}
            busy={loading}
          />
          <SourcesPanel sources={sources} />
        </aside>
      </div>
    </main>
  );
}
