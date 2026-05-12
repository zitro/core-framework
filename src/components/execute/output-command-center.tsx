"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, ClipboardList, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/http";
import type {
  Blocker,
  Discovery,
  EngagementPublishResult,
  ExecuteOutputVersion,
  QuickWin,
  SolutionBlueprint,
} from "@/types/core";
import { BlockerList } from "@/components/execute/blocker-list";
import { FinalWinsPanel } from "@/components/execute/final-wins-panel";
import { OutputLibrary } from "@/components/execute/output-library";
import { PublishExportPanel } from "@/components/execute/publish-export-panel";
import { StatusTile } from "@/components/execute/status-tile";
import { latestOutputsById, type OutputDefinition } from "@/components/execute/output-definitions";

interface OutputCommandCenterProps {
  discovery: Discovery;
  wins: QuickWin[];
  blockers: Blocker[];
  handoffNotes: string;
  saving: boolean;
  onAddWin: (win: Omit<QuickWin, "id" | "done">) => void;
  onToggleWin: (id: string) => void;
  onAddBlocker: (blocker: Omit<Blocker, "id" | "resolved">) => void;
  onToggleBlocker: (id: string) => void;
  onHandoffNotesChange: (notes: string) => void;
  onSaveHandoffNotes: () => void;
}

export function OutputCommandCenter({
  discovery,
  wins,
  blockers,
  handoffNotes,
  saving,
  onAddWin,
  onToggleWin,
  onAddBlocker,
  onToggleBlocker,
  onHandoffNotesChange,
  onSaveHandoffNotes,
}: OutputCommandCenterProps) {
  const [generated, setGenerated] = useState<Record<string, ExecuteOutputVersion>>({});
  const [generatingOutputIds, setGeneratingOutputIds] = useState<string[]>([]);
  const [hydratingOutputs, setHydratingOutputs] = useState(true);
  const [blueprints, setBlueprints] = useState<SolutionBlueprint[]>([]);
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState<EngagementPublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectedSources = useMemo(() => {
    const sources = discovery.engagement_sources ?? [];
    if (sources.length > 0) return sources.map((source) => source.value);
    if (discovery.engagement_repo_paths?.length) return discovery.engagement_repo_paths;
    if (discovery.engagement_repo_path) return [discovery.engagement_repo_path];
    return [];
  }, [discovery.engagement_repo_path, discovery.engagement_repo_paths, discovery.engagement_sources]);

  const readiness = useMemo(() => {
    const openCritical = blockers.filter((item) => !item.resolved && item.severity === "critical").length;
    const openBlockers = blockers.filter((item) => !item.resolved).length;
    const completedWins = wins.filter((item) => item.done).length;
    const validatedAssumptions = (discovery.assumptions ?? []).filter((item) => item.status === "validated").length;
    const ready = openCritical === 0 && completedWins > 0;
    return { openCritical, openBlockers, completedWins, validatedAssumptions, ready };
  }, [blockers, discovery.assumptions, wins]);

  useEffect(() => {
    api.blueprints.list(discovery.id).then(setBlueprints).catch(() => {});
  }, [discovery.id]);

  useEffect(() => {
    let cancelled = false;

    const hydrateOutputs = async () => {
      setHydratingOutputs(true);
      setGeneratingOutputIds([]);
      setError(null);
      setGenerated({});

      try {
        const savedOutputs = await api.executeOutputs.list(discovery.id);
        if (!cancelled) setGenerated(latestOutputsById(savedOutputs));
      } catch {
        if (!cancelled) setGenerated({});
      }

      if (!cancelled) setHydratingOutputs(false);
    };

    void hydrateOutputs();

    return () => {
      cancelled = true;
    };
  }, [discovery.id]);

  const latestBlueprint = blueprints.at(-1);

  const generateOutput = async (definition: OutputDefinition) => {
    setGeneratingOutputIds((current) => current.includes(definition.id) ? current : [...current, definition.id]);
    setError(null);
    try {
      const result = await api.executeOutputs.generate({
        discovery_id: discovery.id,
        output_id: definition.id,
        force: true,
      });
      setGenerated((current) => ({ ...current, [definition.id]: result }));
    } catch (event) {
      setError(event instanceof Error ? event.message : "Failed to generate output");
    } finally {
      setGeneratingOutputIds((current) => current.filter((id) => id !== definition.id));
    }
  };

  const generateBlueprint = async () => {
    setBlueprintBusy(true);
    setError(null);
    try {
      const result = await api.blueprints.generate({
        discovery_id: discovery.id,
        user_instructions: "Generate the final candidate blueprint for Execute handoff. Include the first implementable outcome, implementation risks, and open decisions.",
      });
      setBlueprints((current) => [...current, result]);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Failed to generate blueprint");
    } finally {
      setBlueprintBusy(false);
    }
  };

  const runPublish = async (dryRun: boolean) => {
    setPublishBusy(true);
    setError(null);
    try {
      const result = await api.engagement.publish({
        discovery_id: discovery.id,
        repo_paths: connectedSources,
        dry_run: dryRun,
        use_ai_placement: true,
      });
      setPublishResult(result);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Publish failed");
    } finally {
      setPublishBusy(false);
    }
  };

  const downloadDiscovery = (format: "json" | "csv") => {
    window.open(`${API_URL}/api/export/${discovery.id}?format=${format}`, "_blank", "noopener,noreferrer");
  };

  const copyOutput = async (output: ExecuteOutputVersion) => {
    const text = [
      output.headline,
      output.summary,
      ...output.sections.map((section) => `${section.title}\n${section.body}`),
    ].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatusTile label="Execute Status" value={readiness.ready ? "Ready" : "Needs work"} tone={readiness.ready ? "good" : "warn"} />
        <StatusTile label="Final Wins Confirmed" value={`${readiness.completedWins}/${wins.length}`} />
        <StatusTile label="Open Blockers" value={`${readiness.openBlockers}`} tone={readiness.openCritical ? "bad" : "neutral"} />
        <StatusTile label="Validated Assumptions" value={`${readiness.validatedAssumptions}`} />
      </div>

      <Tabs defaultValue="outputs" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap">
          <TabsTrigger value="outputs" className="gap-1.5"><PackageCheck className="h-3.5 w-3.5" />Output Library</TabsTrigger>
          <TabsTrigger value="readiness" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Readiness</TabsTrigger>
          <TabsTrigger value="publish" className="gap-1.5"><Archive className="h-3.5 w-3.5" />Publish & Export</TabsTrigger>
        </TabsList>

        <TabsContent value="outputs" className="space-y-4">
          <OutputLibrary
            generated={generated}
            generatingOutputIds={generatingOutputIds}
            hydratingOutputs={hydratingOutputs}
            onGenerate={(definition) => void generateOutput(definition)}
            onCopy={(output) => void copyOutput(output)}
          />
        </TabsContent>

        <TabsContent value="readiness" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <FinalWinsPanel wins={wins} onAdd={onAddWin} onToggle={onToggleWin} />
            <BlockerList blockers={blockers} onAdd={onAddBlocker} onToggle={onToggleBlocker} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-violet-500" />Handoff Notes</CardTitle>
              <CardDescription>Capture the final delivery guidance that should travel with the generated materials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={handoffNotes} onChange={(event) => onHandoffNotesChange(event.target.value)} rows={6} placeholder="What should the receiving team know, do next, watch closely, or avoid?" />
              <Button variant="outline" onClick={onSaveHandoffNotes} disabled={saving}>{saving ? "Saving..." : "Save Notes"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publish" className="space-y-4">
          <PublishExportPanel
            latestBlueprint={latestBlueprint}
            blueprintBusy={blueprintBusy}
            publishBusy={publishBusy}
            publishResult={publishResult}
            connectedSources={connectedSources}
            error={error}
            onGenerateBlueprint={() => void generateBlueprint()}
            onRunPublish={(dryRun) => void runPublish(dryRun)}
            onDownloadDiscovery={downloadDiscovery}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
