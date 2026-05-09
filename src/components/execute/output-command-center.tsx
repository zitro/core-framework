"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  FileJson,
  FileSpreadsheet,
  FileText,
  Mail,
  PackageCheck,
  Presentation,
  Send,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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

type NarrativeAudience = "executive" | "technical" | "customer" | "internal";
type NarrativeStyle = "narrative" | "brief" | "outline";

type OutputDefinition = {
  id: string;
  title: string;
  description: string;
  audience: NarrativeAudience;
  style: NarrativeStyle;
  focus: string;
  icon: typeof FileText;
  category: "stakeholder" | "delivery" | "technical";
};

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

const OUTPUTS: OutputDefinition[] = [
  {
    id: "executive-brief",
    title: "Executive Decision Brief",
    description: "Decision-ready summary with recommendation, evidence, risks, and asks.",
    audience: "executive",
    style: "brief",
    focus: "Create a final executive decision brief for sponsors. Include the recommendation, why now, evidence, risks, decisions needed, and next steps.",
    icon: FileText,
    category: "stakeholder",
  },
  {
    id: "customer-summary",
    title: "Customer Summary Update",
    description: "Customer-facing recap that confirms what was heard and what happens next.",
    audience: "customer",
    style: "brief",
    focus: "Create a customer-facing discovery summary update. Reflect the customer's language, summarize what we heard, what we recommend, open questions, and next actions.",
    icon: Send,
    category: "stakeholder",
  },
  {
    id: "weekly-update",
    title: "Weekly Update Email",
    description: "Copy-ready weekly update with progress, decisions, blockers, and next week plan.",
    audience: "internal",
    style: "brief",
    focus: "Create a weekly status email. Include progress this week, key decisions, blockers, risks, asks, and next week priorities.",
    icon: Mail,
    category: "delivery",
  },
  {
    id: "deck-outline",
    title: "Stakeholder Deck Outline",
    description: "Slide-by-slide storyline for the final presentation package.",
    audience: "executive",
    style: "outline",
    focus: "Create a stakeholder deck outline. Include slide titles, slide purpose, key message, and the evidence or artifact each slide should reference.",
    icon: Presentation,
    category: "stakeholder",
  },
  {
    id: "technical-handoff",
    title: "Technical Handoff Brief",
    description: "Build-team handoff with architecture, dependencies, risks, and open decisions.",
    audience: "technical",
    style: "outline",
    focus: "Create a technical handoff brief for implementation leads. Include architecture direction, integration points, dependencies, validation gaps, risks, and immediate engineering work items.",
    icon: Workflow,
    category: "technical",
  },
];

const categoryLabel = {
  stakeholder: "Stakeholder outputs",
  delivery: "Delivery operations",
  technical: "Technical handoff",
};

function latestOutputsById(outputs: ExecuteOutputVersion[]) {
  return outputs.reduce<Record<string, ExecuteOutputVersion>>((acc, output) => {
    const current = acc[output.output_id];
    if (!current || output.version >= current.version) {
      acc[output.output_id] = output;
    }
    return acc;
  }, {});
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
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [blueprints, setBlueprints] = useState<SolutionBlueprint[]>([]);
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState<EngagementPublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectedSources = useMemo(() => {
    const sources = discovery.engagement_sources ?? [];
    if (sources.length > 0) return sources.map((source) => source.value);
    return discovery.engagement_repo_paths?.length
      ? discovery.engagement_repo_paths
      : discovery.engagement_repo_path
        ? [discovery.engagement_repo_path]
        : [];
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
      setAutoGenerating(false);
      setGeneratingOutputIds([]);
      setError(null);
      setGenerated({});

      let savedById: Record<string, ExecuteOutputVersion> = {};
      try {
        const savedOutputs = await api.executeOutputs.list(discovery.id);
        savedById = latestOutputsById(savedOutputs);
        if (!cancelled) setGenerated(savedById);
      } catch {
        if (!cancelled) setGenerated({});
      }

      if (!cancelled) {
        setHydratingOutputs(false);
        setAutoGenerating(true);
        setGeneratingOutputIds(OUTPUTS.filter((definition) => !savedById[definition.id]).map((definition) => definition.id));
      }

      try {
        const ensuredOutputs = await api.executeOutputs.ensure({ discovery_id: discovery.id });
        if (!cancelled) setGenerated(latestOutputsById(ensuredOutputs));
      } catch (event) {
        if (!cancelled) {
          setError(event instanceof Error ? event.message : "Failed to auto-generate Execute outputs");
        }
      } finally {
        if (!cancelled) {
          setGeneratingOutputIds([]);
          setAutoGenerating(false);
        }
      }
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-500" />Output Library</CardTitle>
              <CardDescription>
                {hydratingOutputs
                  ? "Loading saved final materials."
                  : autoGenerating
                    ? "Checking latest discovery context and filling any missing final materials."
                    : "Final materials generated from Capture, Orchestrate, Refine, and Execute context."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(categoryLabel).map(([category, label]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {OUTPUTS.filter((item) => item.category === category).map((item) => {
                      const Icon = item.icon;
                      const output = generated[item.id];
                      const generating = generatingOutputIds.includes(item.id);
                      const loadingSavedOutput = hydratingOutputs && !output;
                      return (
                        <div key={item.id} className="rounded-md border p-3 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600"><Icon className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">{item.title}</p>
                                {output && <Badge variant="secondary" className="text-[10px]">v{output.version}</Badge>}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void generateOutput(item)} disabled={hydratingOutputs || generating}>
                              {loadingSavedOutput ? "Loading..." : generating ? "Generating..." : output ? "Regenerate" : "Generate"}
                            </Button>
                            {output && <Button size="sm" variant="outline" onClick={() => void copyOutput(output)}>Copy</Button>}
                          </div>
                          {output ? <GeneratedPreview output={output} /> : (loadingSavedOutput || generating) && (
                            <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                              {loadingSavedOutput ? "Loading the saved output for this discovery..." : "Building this output from the latest discovery data..."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Archive className="h-4 w-4 text-violet-500" />Publish & Export</CardTitle>
              <CardDescription>Package approved outputs, create the final blueprint, and export the discovery record.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <ActionPanel title="Solution Blueprint" description={latestBlueprint?.approach_title || "Generate or refresh the candidate architecture package."}>
                  <Button size="sm" onClick={() => void generateBlueprint()} disabled={blueprintBusy}>{blueprintBusy ? "Generating..." : latestBlueprint ? "Regenerate Blueprint" : "Generate Blueprint"}</Button>
                </ActionPanel>
                <ActionPanel title="Repo Publish" description={connectedSources.length > 0 ? `${connectedSources.length} connected source(s)` : "Connect a source on Capture before publishing."}>
                  <Button size="sm" variant="outline" onClick={() => void runPublish(true)} disabled={publishBusy || connectedSources.length === 0}>Plan Publish</Button>
                  <Button size="sm" onClick={() => void runPublish(false)} disabled={publishBusy || connectedSources.length === 0}>Publish</Button>
                </ActionPanel>
                <ActionPanel title="Discovery Export" description="Download the source-of-truth discovery record and evidence table.">
                  <Button size="sm" variant="outline" onClick={() => downloadDiscovery("json")}><FileJson className="mr-1.5 h-3.5 w-3.5" />JSON</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadDiscovery("csv")}><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />CSV</Button>
                </ActionPanel>
              </div>

              {latestBlueprint && (
                <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">Blueprint v{latestBlueprint.version}</Badge><p className="text-sm font-semibold">{latestBlueprint.approach_title}</p></div>
                  <p className="text-sm text-muted-foreground">{latestBlueprint.approach_summary}</p>
                  <p className="text-xs"><span className="font-medium">First outcome:</span> {latestBlueprint.quick_win_suggestion}</p>
                </div>
              )}

              {publishResult && (
                <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
                  <p className="font-medium">{publishResult.dry_run ? "Publish plan" : "Publish complete"}: {publishResult.count} item(s)</p>
                  <p className="text-xs text-muted-foreground">Skipped: {publishResult.skipped.length} | Errors: {publishResult.errors.length}</p>
                </div>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-md border bg-background px-4 py-3 text-center">
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function GeneratedPreview({ output }: { output: ExecuteOutputVersion }) {
  return (
    <div className="rounded-md bg-muted/40 p-3 text-sm space-y-2">
      <p className="font-medium">{output.headline}</p>
      <p className="text-muted-foreground">{output.summary}</p>
      {output.sections.slice(0, 2).map((section) => (
        <div key={section.title}>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{section.title}</p>
          <p className="text-xs leading-relaxed">{section.body}</p>
        </div>
      ))}
    </div>
  );
}

function FinalWinsPanel({
  wins,
  onAdd,
  onToggle,
}: {
  wins: QuickWin[];
  onAdd: (win: Omit<QuickWin, "id" | "done">) => void;
  onToggle: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [impact, setImpact] = useState<QuickWin["impact"]>("high");

  const addFinalWin = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), owner: owner.trim(), impact, effort: "low" });
    setTitle("");
    setOwner("");
    setImpact("high");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Final Wins
        </CardTitle>
        <CardDescription>
          State the actual wins, outcomes, or confirmed value that should appear in final outputs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_150px_auto]">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Confirmed win or outcome"
            onKeyDown={(event) => event.key === "Enter" && addFinalWin()}
          />
          <select
            value={impact}
            onChange={(event) => setImpact(event.target.value as QuickWin["impact"])}
            className="flex h-9 rounded-md border bg-background px-3 text-sm"
            title="Final win impact"
          >
            <option value="high">High impact</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner" />
          <Button size="sm" onClick={addFinalWin}>Add</Button>
        </div>

        {wins.length > 0 ? (
          <div className="space-y-2">
            {wins.map((win) => (
              <div key={win.id} className="flex items-center gap-3 rounded-md border p-3">
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onToggle(win.id)}>
                  <CheckCircle2 className={`h-4 w-4 ${win.done ? "text-emerald-500" : "text-muted-foreground"}`} />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${win.done ? "" : "text-muted-foreground"}`}>{win.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {win.done ? "Confirmed for final outputs" : "Draft win, confirm before final package"}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">{win.impact} impact</Badge>
                {win.owner && <Badge variant="secondary" className="text-[10px]">{win.owner}</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No final wins have been set yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-md border p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
