"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, History, MessageSquarePlus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { ContextBriefVersion } from "@/types/core";

interface ContextBriefBuilderProps {
  discoveryId: string;
  context: string;
  onContextChange: Dispatch<SetStateAction<string>>;
  workingNotes: string;
  onWorkingNotesChange: (value: string) => void;
  onAddWorkingNotes: () => void;
  contextTextareaRef?: RefObject<HTMLTextAreaElement | null>;
}

const formatBriefAsContext = (version: ContextBriefVersion) => {
  const lines = [
    `AI project brief v${version.version}: ${version.title || "Project Brief"}`,
    version.summary,
    "",
    "Goals:",
    ...version.goals.map((item) => `- ${item}`),
    "",
    "Stakeholders:",
    ...version.stakeholders.map((item) => `- ${item}`),
    "",
    "Constraints and risks:",
    ...[...version.constraints, ...version.risks].map((item) => `- ${item}`),
    "",
    "Open questions:",
    ...version.open_questions.map((item) => `- ${item}`),
  ];

  return lines.filter((line, index) => line.trim() || lines[index - 1]?.trim()).join("\n").trim();
};

const REVIEW_PROMPTS = [
  {
    label: "Missing Stakeholder",
    body: "Add or correct stakeholder context:\n- Role/team:\n- Why they matter:\n- Decision or input needed:",
  },
  {
    label: "Wrong Priority",
    body: "Correct the project priority:\n- What the brief overstates or misses:\n- What matters most now:\n- Why:",
  },
  {
    label: "Add Constraint",
    body: "Add delivery constraint:\n- Constraint:\n- Owner/team affected:\n- Impact on timeline or scope:",
  },
  {
    label: "Add Open Question",
    body: "Add open question:\n- Question:\n- Why it matters:\n- Who can answer it:",
  },
];

function SynthesisSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="rounded-md border bg-background p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {items.length > 0 ? (
        <ol className="space-y-2 text-sm">
          {items.map((item, index) => (
            <li key={`${title}:${index}`} className="flex gap-2 leading-relaxed">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
          Nothing explicit yet.
        </p>
      )}
    </section>
  );
}

export function ContextBriefBuilder({
  discoveryId,
  context,
  onContextChange,
  workingNotes,
  onWorkingNotesChange,
  onAddWorkingNotes,
  contextTextareaRef,
}: ContextBriefBuilderProps) {
  const [versions, setVersions] = useState<ContextBriefVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<ContextBriefVersion | null>(null);
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showSourceMaterial, setShowSourceMaterial] = useState(false);
  const reviewNoteRef = useRef<HTMLTextAreaElement | null>(null);

  const generate = useCallback(async (
    force: boolean,
    override?: { workingContext?: string; userInstructions?: string },
  ) => {
    if (!discoveryId) return;
    setGenerating(true);
    setError(null);
    const workingContext = override?.workingContext ?? [context.trim(), workingNotes.trim()].filter(Boolean).join("\n\n");
    const userInstructions = override?.userInstructions ?? instructions;
    try {
      const result = await api.contextBriefs.generate({
        discovery_id: discoveryId,
        user_instructions: userInstructions || undefined,
        working_context: workingContext || undefined,
        force,
      });
      setVersions((prev) => {
        if (prev.some((item) => item.id === result.id)) return prev;
        return [...prev, result];
      });
      setActiveVersion(result);
      setInstructions("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate project brief");
    } finally {
      setGenerating(false);
    }
  }, [context, discoveryId, instructions, workingNotes]);

  useEffect(() => {
    if (!discoveryId) return;
    setLoaded(false);
    api.contextBriefs.list(discoveryId).then((items) => {
      setVersions(items);
      setActiveVersion(items.at(-1) ?? null);
    }).catch(() => { /* non-critical */ })
      .finally(() => setLoaded(true));
  }, [discoveryId]);

  // Auto-fire of generate(false) removed (same reasoning as P5-fix-P0):
  // contextBriefs.generate hits the LLM-backed /api/context-briefs/generate
  // endpoint which 502s without an LLM provider. Two explicit buttons
  // below (Generate Brief / Force Regenerate) give the user control.

  const addBriefToContext = () => {
    if (!activeVersion) return;
    const block = formatBriefAsContext(activeVersion);
    onContextChange((previous) => {
      if (previous.includes(block)) return previous;
      return [previous.trim(), block].filter(Boolean).join("\n\n");
    });
    window.requestAnimationFrame(() => contextTextareaRef?.current?.focus());
  };

  const applyReviewPrompt = (body: string) => {
    onWorkingNotesChange(body);
    window.requestAnimationFrame(() => reviewNoteRef.current?.focus());
  };

  const saveReviewNote = () => {
    if (!workingNotes.trim()) return;
    onAddWorkingNotes();
  };

  const updateBriefWithReviewNote = async () => {
    const note = workingNotes.trim();
    const nextContext = [context.trim(), note].filter(Boolean).join("\n\n");
    if (note) {
      onContextChange(nextContext);
      onWorkingNotesChange("");
    }
    await generate(true, {
      workingContext: nextContext,
      userInstructions: instructions.trim() || note,
    });
  };

  return (
    <Card className="border-amber-500/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Project Understanding
            </CardTitle>
            <CardDescription>
              Review the brief, add what is wrong or missing, then update the understanding used by questions and drafts.
            </CardDescription>
          </div>
          {versions.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowHistory((value) => !value)}>
              <History className="mr-1.5 h-3.5 w-3.5" />
              v{versions.length}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showHistory && versions.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Version History</p>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => {
                      setActiveVersion(version);
                      setShowHistory(false);
                    }}
                    className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">v{version.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm">{version.title || version.summary}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)]">
          <div className="space-y-4">
            {activeVersion ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-amber-500/5 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">v{activeVersion.version}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activeVersion.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold">{activeVersion.title || "AI Brief"}</h3>
                  <p className="mt-2 text-sm leading-relaxed">{activeVersion.summary}</p>
                  {activeVersion.evidence_summary && (
                    <p className="mt-3 text-xs text-muted-foreground">{activeVersion.evidence_summary}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={updateBriefWithReviewNote} disabled={generating} className="gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      {generating ? "Updating..." : "Update Understanding"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={addBriefToContext}>
                      Use Brief As Source Material
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <SynthesisSection
                    title="What We Are Trying To Achieve"
                    description="Scope, outcomes, and success measures."
                    items={activeVersion.goals}
                  />
                  <SynthesisSection
                    title="Who Needs To Align"
                    description="Sponsors, owners, decision makers, and working team."
                    items={activeVersion.stakeholders}
                  />
                  <SynthesisSection
                    title="What Could Slow Delivery"
                    description="Known constraints and risks to manage."
                    items={[...activeVersion.constraints, ...activeVersion.risks]}
                  />
                  <SynthesisSection
                    title="Decisions Needed Next"
                    description="Questions that should drive the next working session."
                    items={activeVersion.open_questions}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
                No AI brief has been generated yet.
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-md border bg-muted/20 p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquarePlus className="h-4 w-4" />
                Improve The Brief
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Add one correction, missing fact, or decision. CORE folds it into the next version.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border bg-background px-2 py-2">
                <p className="font-semibold">1</p>
                <p className="text-muted-foreground">Review</p>
              </div>
              <div className="rounded-md border bg-background px-2 py-2">
                <p className="font-semibold">2</p>
                <p className="text-muted-foreground">Correct</p>
              </div>
              <div className="rounded-md border bg-background px-2 py-2">
                <p className="font-semibold">3</p>
                <p className="text-muted-foreground">Update</p>
              </div>
            </div>

            <Textarea
              ref={reviewNoteRef}
              value={workingNotes}
              onChange={(event) => onWorkingNotesChange(event.target.value)}
              placeholder="Example: The sponsor is Finance Ops, not IT. The first outcome is reducing manual reconciliation time before expanding to analytics automation."
              rows={7}
            />

            <div className="flex flex-wrap gap-2">
              {REVIEW_PROMPTS.map((prompt) => (
                <Button
                  key={prompt.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyReviewPrompt(prompt.body)}
                >
                  {prompt.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={updateBriefWithReviewNote} disabled={generating || (!workingNotes.trim() && !instructions.trim())} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {generating ? "Updating..." : "Update Brief"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={saveReviewNote}
                disabled={!workingNotes.trim()}
              >
                Save Note Only
              </Button>
            </div>

            <div className="space-y-2 rounded-md border bg-background/70 p-3">
              <p className="text-sm font-medium">Optional AI direction</p>
              <Textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Example: tighten this around the operating model and remove speculative technology recommendations."
                rows={2}
              />
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm font-medium hover:bg-muted/40"
              onClick={() => setShowSourceMaterial((value) => !value)}
            >
              <span>Source Material</span>
              {showSourceMaterial ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {showSourceMaterial && (
              <div className="space-y-3 rounded-md border bg-background/70 p-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Current Process</Badge>
                  <Badge variant="outline">Technology Landscape</Badge>
                  <Badge variant="outline">Approvals & Governance</Badge>
                  <Badge variant="outline">Environment Setup</Badge>
                  <Badge variant="outline">Use Case & Business Value</Badge>
                </div>
                <Textarea
                  ref={contextTextareaRef}
                  value={context}
                  onChange={(event) => onContextChange(event.target.value)}
                  placeholder="Source notes and corrections that should shape questions and draft artifacts."
                  rows={8}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void generate(false)} disabled={generating}>
                {activeVersion ? "Refresh From Saved Sources" : "Generate Brief"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void generate(true)} disabled={generating}>
                Force New Version
              </Button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
