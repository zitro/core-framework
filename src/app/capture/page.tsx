"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MessageSquare, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Question, Evidence, TranscriptAnalysis, QuestionSet } from "@/types/core";
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
  const { activeDiscovery } = useDiscovery();
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
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to generate questions — is the backend running?",
      );
    } finally {
      setGenerating(false);
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

          <PreviousAnalysesList
            analyses={savedAnalyses}
            onDeleted={(id) => setSavedAnalyses((prev) => prev.filter((a) => a.id !== id))}
          />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
