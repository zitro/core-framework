"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MessageSquare, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Question, Evidence, TranscriptAnalysis, QuestionSet } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";

export default function CapturePage() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuestionSets, setSavedQuestionSets] = useState<QuestionSet[]>([]);
  const [context, setContext] = useState("");
  const [transcript, setTranscript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedEvidence, setExtractedEvidence] = useState<Evidence[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<TranscriptAnalysis[]>([]);
  const [analysisResult, setAnalysisResult] = useState<{
    insights: { text: string; confidence: string }[];
    key_themes: string[];
    sentiment: string;
  } | null>(null);

  // Load saved transcript analyses and question sets on mount / discovery change
  const loadSavedData = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const [analyses, qSets] = await Promise.all([
        api.transcripts.list(discoveryId),
        api.questions.list(discoveryId, "capture"),
      ]);
      setSavedAnalyses(analyses);
      setSavedQuestionSets(qSets);
      // Restore the most recent question set if no questions are loaded yet
      if (qSets.length > 0) {
        const latest = qSets[qSets.length - 1];
        setQuestions(latest.questions);
        if (latest.context) setContext(latest.context);
      }
    } catch { /* non-critical — first load may have no data */ }
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
      setError(e instanceof Error ? e.message : "Failed to generate questions — is the backend running?");
    } finally {
      setGenerating(false);
    }
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
      // Auto-import extracted evidence
      if (result.evidence_extracted?.length && discoveryId) {
        const saved: Evidence[] = [];
        for (const ev of result.evidence_extracted) {
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
          } catch { /* skip individual failures */ }
        }
        setExtractedEvidence(saved);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze transcript — is the backend running?");
    } finally {
      setAnalyzing(false);
    }
  };

  const confidenceColor = (c: string) => {
    switch (c) {
      case "validated": return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
      case "assumed": return "bg-amber-500/10 text-amber-700 border-amber-500/30";
      case "conflicting": return "bg-red-500/10 text-red-700 border-red-500/30";
      default: return "bg-zinc-500/10 text-zinc-600 border-zinc-500/30";
    }
  };

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <Search className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Select or create a discovery from the Dashboard to start capturing.</p>
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
                placeholder="e.g., We're working with a fintech firm that has a legacy trading platform. They want to modernize but aren't sure what the real pain points are. Meeting with the portfolio management team tomorrow."
                rows={4}
              />
              <Button onClick={generateQuestions} disabled={generating}>
                {generating ? "Generating..." : "Generate Capture Questions"}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </CardContent>
          </Card>

          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Generated Questions
                  <Badge variant="secondary" className="ml-2">
                    {questions.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Use these in your next stakeholder session. Click to copy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {questions.map((q, i) => (
                      <div key={i} className="group">
                        <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigator.clipboard.writeText(q.text)}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{q.text}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Purpose: {q.purpose}
                            </p>
                            {q.follow_ups?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                  Follow-ups
                                </p>
                                {q.follow_ups.map((f, j) => (
                                  <p key={j} className="text-xs text-muted-foreground pl-3 border-l">
                                    {f}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {i < questions.length - 1 && <Separator className="mt-2" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Analysis Results</CardTitle>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">Sentiment: {analysisResult.sentiment}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Key Themes</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.key_themes.map((theme, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Insights</h4>
                  <div className="space-y-2">
                    {analysisResult.insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded border">
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${confidenceColor(insight.confidence)}`}
                        >
                          {insight.confidence}
                        </Badge>
                        <p className="text-sm">{insight.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {extractedEvidence.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Evidence Saved
                        <Badge variant="secondary" className="ml-2">{extractedEvidence.length}</Badge>
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Auto-extracted from transcript and saved to the Evidence Board.
                      </p>
                      <div className="space-y-1">
                        {extractedEvidence.map((ev) => (
                          <div key={ev.id} className="text-xs p-2 rounded border bg-blue-500/5">
                            {ev.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {savedAnalyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Previous Analyses
                  <Badge variant="secondary" className="ml-2">{savedAnalyses.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Saved transcript analyses for this discovery. Evidence is already on the Evidence Board.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {[...savedAnalyses].reverse().map((a) => (
                      <div key={a.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {a.sentiment}
                            </Badge>
                            {a.key_themes.slice(0, 3).map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                {t}
                              </Badge>
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {a.transcript_text}
                        </p>
                        {a.insights.length > 0 && (
                          <div className="space-y-1">
                            {a.insights.slice(0, 3).map((ins, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <Badge variant="outline" className={`text-[9px] shrink-0 ${confidenceColor(ins.confidence)}`}>
                                  {ins.confidence}
                                </Badge>
                                <p className="text-xs">{ins.text}</p>
                              </div>
                            ))}
                            {a.insights.length > 3 && (
                              <p className="text-[10px] text-muted-foreground">
                                +{a.insights.length - 3} more insights
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
