"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MessageSquare, Upload, Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type {
  Question,
  Evidence,
  TranscriptAnalysis,
  QuestionSet,
  TechnologyTarget,
} from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";
import { QuestionList } from "@/components/capture/question-list";
import {
  TranscriptAnalysisResult,
  type AnalysisSummary,
} from "@/components/capture/transcript-analysis-result";
import { PreviousAnalysesList } from "@/components/capture/previous-analyses-list";

export default function CapturePage() {
  const { activeDiscovery, setActiveDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [, setSavedQuestionSets] = useState<QuestionSet[]>([]);
  const [context, setContext] = useState("");
  const [transcript, setTranscript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedEvidence, setExtractedEvidence] = useState<Evidence[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<TranscriptAnalysis[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSummary | null>(null);
  const [technologyInput, setTechnologyInput] = useState("");
  const [technologyFocusInput, setTechnologyFocusInput] = useState("");
  const [technologyTargets, setTechnologyTargets] = useState<TechnologyTarget[]>([]);
  const [savingTechnologies, setSavingTechnologies] = useState(false);
  const [latestGroundingSources, setLatestGroundingSources] = useState<QuestionSet["grounding_sources"]>([]);

  useEffect(() => {
    if (!activeDiscovery) return;
    if (activeDiscovery.target_technologies && activeDiscovery.target_technologies.length > 0) {
      setTechnologyTargets(activeDiscovery.target_technologies);
      return;
    }
    const fallback = (activeDiscovery.solution_providers ?? []).map((name) => ({
      name,
      focus: "",
    }));
    setTechnologyTargets(fallback);
  }, [
    activeDiscovery?.id,
    activeDiscovery?.solution_providers,
    activeDiscovery?.target_technologies,
  ]);

  const loadSavedData = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const [analyses, qSets] = await Promise.all([
        api.transcripts.list(discoveryId),
        api.questions.list(discoveryId, "capture"),
      ]);
      setSavedAnalyses(analyses);
      setSavedQuestionSets(qSets);
      if (qSets.length > 0) {
        const latest = qSets[qSets.length - 1];
        setQuestions(latest.questions);
        setLatestGroundingSources(latest.grounding_sources ?? []);
        if (latest.context) setContext(latest.context);
      }
    } catch {
      /* non-critical — first load may have no data */
    }
  }, [discoveryId]);

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  const generateQuestions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.questions.generate({
        discovery_id: discoveryId,
        phase: "capture",
        context,
        num_questions: 8,
      });
      setQuestions(result.questions);
      setSavedQuestionSets((prev) => [...prev, result]);
      setLatestGroundingSources(result.grounding_sources ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to generate questions — is the backend running?",
      );
    } finally {
      setGenerating(false);
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
    <PhaseShell phase="capture" discoveryId={discoveryId}>
      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Question Generator
          </TabsTrigger>
          <TabsTrigger value="transcript" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Transcript Analyzer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discovery Context</CardTitle>
              <CardDescription>
                Describe the engagement so the AI can tailor questions to your situation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., We're working with a fintech firm that has a legacy trading platform. They want to modernize but aren't sure what the real pain points are."
                rows={4}
              />
              <Button onClick={generateQuestions} disabled={generating}>
                {generating ? "Generating..." : "Generate Capture Questions"}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </CardContent>
          </Card>

          <QuestionList questions={questions} />

          {latestGroundingSources && latestGroundingSources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grounding Summary</CardTitle>
                <CardDescription>
                  These sources influenced the latest generated questions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestGroundingSources.map((item, index) => (
                  <div key={`${item.url}-${index}`} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {item.query || "topic"}
                      </Badge>
                      {item.source && (
                        <Badge variant="secondary" className="text-[10px]">
                          {item.source}
                        </Badge>
                      )}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {item.title || item.url}
                    </a>
                    {item.snippet && <p className="text-xs text-muted-foreground">{item.snippet}</p>}
                    {index < latestGroundingSources.length - 1 && <Separator className="mt-2" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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
