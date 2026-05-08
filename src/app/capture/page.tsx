"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  Evidence,
  TranscriptAnalysis,
  TechnologyTarget,
} from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";
import { EngagementConfig } from "@/components/settings/engagement-config";
import { PhaseEvidencePanel } from "@/components/layout/phase-evidence-panel";
import { DtMethodsPanel } from "@/components/layout/dt-methods-panel";
import {
  TranscriptAnalysisResult,
  type AnalysisSummary,
} from "@/components/capture/transcript-analysis-result";
import { PreviousAnalysesList } from "@/components/capture/previous-analyses-list";

interface CaptureDraft {
  context: string;
  transcript: string;
  quickNote: string;
  captureItemType: CaptureItemType;
  captureReference: string;
  technologyInput: string;
  technologyFocusInput: string;
  technologyTargets: TechnologyTarget[];
}

type CaptureItemType = "note" | "document" | "presentation" | "file";

export default function CapturePage() {
  const { activeDiscovery, setActiveDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";

  const [context, setContext] = useState(activeDiscovery?.description ?? "");
  const [transcript, setTranscript] = useState("");
  const [savingContext, setSavingContext] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedEvidence, setExtractedEvidence] = useState<Evidence[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<TranscriptAnalysis[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSummary | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<Evidence[]>([]);
  const [quickNote, setQuickNote] = useState("");
  const [captureItemType, setCaptureItemType] = useState<CaptureItemType>("note");
  const [captureReference, setCaptureReference] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [technologyInput, setTechnologyInput] = useState("");
  const [technologyFocusInput, setTechnologyFocusInput] = useState("");
  const [technologyTargets, setTechnologyTargets] = useState<TechnologyTarget[]>([]);
  const [savingTechnologies, setSavingTechnologies] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const captureDraftKey = useMemo(
    () => `core:capture-draft:${discoveryId || activeDiscovery?.project_id || "global"}`,
    [activeDiscovery?.project_id, discoveryId],
  );

  const readCaptureDraft = useCallback((): CaptureDraft | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(captureDraftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CaptureDraft;
      return {
        context: parsed.context || "",
        transcript: parsed.transcript || "",
        quickNote: parsed.quickNote || "",
        captureItemType: (parsed.captureItemType as CaptureItemType) || "note",
        captureReference: parsed.captureReference || "",
        technologyInput: parsed.technologyInput || "",
        technologyFocusInput: parsed.technologyFocusInput || "",
        technologyTargets: Array.isArray(parsed.technologyTargets) ? parsed.technologyTargets : [],
      };
    } catch {
      return null;
    }
  }, [captureDraftKey]);

  useEffect(() => {
    if (!activeDiscovery) {
      setDraftHydrated(false);
      return;
    }

    const draft = readCaptureDraft();
    const persistedTargets = activeDiscovery.target_technologies ?? [];
    const providerFallbackTargets = (activeDiscovery.solution_providers ?? []).map((name) => ({
      name,
      focus: "",
    }));

    const nextTargets =
      persistedTargets.length > 0
        ? persistedTargets
        : providerFallbackTargets.length > 0
          ? providerFallbackTargets
          : (draft?.technologyTargets ?? []);

    setContext(activeDiscovery.description || draft?.context || "");
    setTranscript(draft?.transcript || "");
    setQuickNote(draft?.quickNote || "");
    setCaptureItemType(draft?.captureItemType || "note");
    setCaptureReference(draft?.captureReference || "");
    setTechnologyInput(draft?.technologyInput || "");
    setTechnologyFocusInput(draft?.technologyFocusInput || "");
    setTechnologyTargets(nextTargets);
    setDraftHydrated(true);
  }, [
    activeDiscovery,
    activeDiscovery?.description,
    activeDiscovery?.id,
    activeDiscovery?.solution_providers,
    activeDiscovery?.target_technologies,
    readCaptureDraft,
  ]);

  useEffect(() => {
    if (!activeDiscovery || !draftHydrated || typeof window === "undefined") return;
    const payload: CaptureDraft = {
      context,
      transcript,
      quickNote,
      captureItemType,
      captureReference,
      technologyInput,
      technologyFocusInput,
      technologyTargets,
    };
    try {
      window.localStorage.setItem(captureDraftKey, JSON.stringify(payload));
    } catch {
      /* ignore localStorage failures */
    }
  }, [
    activeDiscovery,
    captureDraftKey,
    captureItemType,
    captureReference,
    context,
    draftHydrated,
    quickNote,
    technologyFocusInput,
    technologyInput,
    technologyTargets,
    transcript,
  ]);

  const loadSavedData = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const [analyses, evidenceItems] = await Promise.all([
        api.transcripts.list(discoveryId),
        api.evidence.list(discoveryId, "capture"),
      ]);
      setSavedAnalyses(analyses);
      setCaptureEvidence(evidenceItems);
    } catch {
      /* non-critical — first load may have no data */
    }
  }, [discoveryId]);

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  const saveContext = async () => {
    if (!discoveryId) return;
    setSavingContext(true);
    setError(null);
    try {
      const updated = await api.discoveries.update(discoveryId, { description: context });
      setActiveDiscovery(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save customer context");
    } finally {
      setSavingContext(false);
    }
  };

  const persistTechnologyTargets = async (targets: TechnologyTarget[]) => {
    if (!discoveryId) return;
    setSavingTechnologies(true);
    try {
      const updated = await api.discoveries.update(discoveryId, {
        target_technologies: targets,
        solution_providers: targets.map((item) => item.name),
      });
      setActiveDiscovery(updated);
    } catch {
      // keep local state optimistic; user can retry on next edit
    } finally {
      setSavingTechnologies(false);
    }
  };

  const addTechnology = async () => {
    if (!technologyInput.trim() || !discoveryId) return;
    const name = technologyInput.trim();
    const focus = technologyFocusInput.trim();
    const exists = technologyTargets.some(
      (target) =>
        target.name.toLowerCase() === name.toLowerCase() &&
        target.focus.toLowerCase() === focus.toLowerCase()
    );
    if (exists) {
      setTechnologyInput("");
      setTechnologyFocusInput("");
      return;
    }
    const next = [...technologyTargets, { name, focus }];
    setTechnologyTargets(next);
    setTechnologyInput("");
    setTechnologyFocusInput("");
    await persistTechnologyTargets(next);
  };

  const removeTechnology = async (name: string, focus: string) => {
    if (!discoveryId) return;
    const next = technologyTargets.filter(
      (target) => !(target.name === name && target.focus === focus)
    );
    setTechnologyTargets(next);
    await persistTechnologyTargets(next);
  };

  const addQuickNote = async () => {
    if (!quickNote.trim() || !discoveryId) return;
    setSavingNote(true);
    setError(null);
    const sourceByType: Record<CaptureItemType, string> = {
      note: "Capture note",
      document: "Document evidence",
      presentation: "Presentation evidence",
      file: "File evidence",
    };
    try {
      const created = await api.evidence.create({
        discovery_id: discoveryId,
        phase: "capture",
        content: quickNote.trim(),
        source: captureReference.trim() || sourceByType[captureItemType],
        evidence_type: captureItemType === "note" ? "observation" : "general",
        tags: captureItemType === "note" ? ["note"] : ["evidence", captureItemType],
      });
      setCaptureEvidence((prev) => [...prev, created]);
      setQuickNote("");
      setCaptureReference("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save capture note");
    } finally {
      setSavingNote(false);
    }
  };

  const importExtractedEvidence = async (evidence: Evidence[]) => {
    if (!evidence.length || !discoveryId) return;
    const saved: Evidence[] = [];
    for (const ev of evidence) {
      try {
        const created = await api.evidence.create({
          discovery_id: discoveryId,
          phase: "capture",
          content: ev.content,
          source: ev.source || "Transcript analysis",
          confidence: ev.confidence || "unknown",
          tags: ev.tags || [],
        });
        saved.push(created);
      } catch {
        /* skip individual failures */
      }
    }
    setExtractedEvidence(saved);
  };

  const analyzeTranscript = async () => {
    if (!transcript.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await api.transcripts.analyze({
        discovery_id: discoveryId,
        transcript_text: transcript,
      });
      setSavedAnalyses((prev) => [...prev, result]);
      setAnalysisResult({
        insights: result.insights.map((i) => ({
          text: typeof i === "string" ? i : i.text,
          confidence: typeof i === "string" ? "unknown" : i.confidence,
        })),
        key_themes: result.key_themes,
        sentiment: result.sentiment,
      });
      await importExtractedEvidence(result.evidence_extracted ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to analyze transcript — is the backend running?",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <Search className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">
          Select or create a discovery from the Dashboard to start capturing.
        </p>
      </div>
    );
  }

  return (
    <PhaseShell
      phase="capture"
      discoveryId={discoveryId}
      showEvidencePanel={false}
      showDtMethodsPanel={false}
    >
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="technologies">Technologies</TabsTrigger>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="analysis">Analyses</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <EngagementConfig
            discovery={activeDiscovery}
            onUpdate={(patch) => {
              api.discoveries.update(activeDiscovery.id, patch).then((updated) => {
                setActiveDiscovery(updated);
              }).catch(() => {});
            }}
          />
        </TabsContent>

        <TabsContent value="context" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Context</CardTitle>
              <CardDescription>
                Capture everything you know about the customer before moving into orchestration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Customer goals, operating model, constraints, stakeholders, urgency, environment realities, and known risks."
                rows={6}
              />
              <Button onClick={saveContext} disabled={savingContext}>
                {savingContext ? "Saving..." : "Save Customer Context"}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capture Notes and Evidence</CardTitle>
              <CardDescription>
                Add fast notes or evidence references in one place, then review all capture evidence below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Item Type</p>
                  <select
                    value={captureItemType}
                    onChange={(e) => setCaptureItemType(e.target.value as CaptureItemType)}
                    aria-label="Capture item type"
                    title="Capture item type"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="note">Note</option>
                    <option value="document">Evidence: Document</option>
                    <option value="presentation">Evidence: Presentation</option>
                    <option value="file">Evidence: Other File</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Reference (optional)</p>
                  <Input
                    value={captureReference}
                    onChange={(e) => setCaptureReference(e.target.value)}
                    placeholder="URL, filename, or source note"
                  />
                </div>
              </div>

              <Textarea
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder={
                  captureItemType === "note"
                    ? "Add a capture note, quote, or finding..."
                    : "Describe the evidence from this file or reference..."
                }
                rows={3}
              />
              <Button onClick={addQuickNote} disabled={savingNote || !quickNote.trim()}>
                {savingNote
                  ? "Saving..."
                  : captureItemType === "note"
                    ? "Add Capture Note"
                    : "Add Evidence Item"}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              {captureEvidence.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Recent capture items
                  </p>
                  {captureEvidence.slice(-8).reverse().map((item) => (
                    <div key={item.id} className="rounded-md border p-2">
                      <p className="text-sm">{item.content}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{item.source || "Capture note"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <PhaseEvidencePanel discoveryId={discoveryId} phase="capture" collapsible={false} />
        </TabsContent>

        <TabsContent value="technologies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Technologies</CardTitle>
              <CardDescription>
                Add the technologies this customer wants to use so CORE can tailor discovery
                questions from the start.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  value={technologyInput}
                  onChange={(e) => setTechnologyInput(e.target.value)}
                  placeholder="Technology, e.g., Microsoft Fabric"
                  rows={1}
                />
                <Textarea
                  value={technologyFocusInput}
                  onChange={(e) => setTechnologyFocusInput(e.target.value)}
                  placeholder="Specific focus, e.g., Ontologies"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void addTechnology();
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    void addTechnology();
                  }}
                  disabled={savingTechnologies || !technologyInput.trim()}
                  className="self-start"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {technologyTargets.length > 0 && (
                <div className="space-y-2">
                  {technologyTargets.map((target) => (
                    <div
                      key={`${target.name}::${target.focus}`}
                      className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
                    >
                      <Badge variant="secondary" className="px-2 py-1">
                        {target.name}
                      </Badge>
                      {target.focus && (
                        <Badge variant="outline" className="px-2 py-1">
                          Focus: {target.focus}
                        </Badge>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${target.name}`}
                        className="inline-flex items-center"
                        onClick={() => {
                          void removeTechnology(target.name, target.focus);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="space-y-4">
          <DtMethodsPanel phase="capture" discoveryId={discoveryId} />
        </TabsContent>

        <TabsContent value="transcript" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paste Transcript</CardTitle>
              <CardDescription>
                Paste a meeting transcript and the AI will extract evidence, insights, and themes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here..."
                rows={8}
              />
              <Button onClick={analyzeTranscript} disabled={analyzing || !transcript.trim()}>
                {analyzing ? "Analyzing..." : "Analyze Transcript"}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {analysisResult && (
            <TranscriptAnalysisResult
              result={analysisResult}
              extractedEvidence={extractedEvidence}
            />
          )}

          <PreviousAnalysesList analyses={savedAnalyses} />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
