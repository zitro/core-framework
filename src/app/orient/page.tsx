"use client";

import { useCallback, useEffect, useState } from "react";
import { Compass, Network, FileText, Briefcase } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { Evidence, QuestionSet } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";
import { ProblemStatementBuilder } from "@/components/orient/problem-statement-builder";
import { UseCaseBuilder } from "@/components/orient/use-case-builder";

export default function OrientPage() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";
  const [questions, setQuestions] = useState<{ text: string; purpose: string; follow_ups: string[] }[]>([]);
  const [savedQuestionSets, setSavedQuestionSets] = useState<QuestionSet[]>([]);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<Evidence[]>([]);

  const loadCaptureEvidence = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const items = await api.evidence.list(discoveryId, "capture");
      setCaptureEvidence(items);
      if (items.length > 0 && !context) {
        const summary = items.map((e) => `- ${e.content}`).join("\n");
        setContext(`Evidence from Capture phase:\n${summary}`);
      }
    } catch { /* non-critical */ }
  }, [discoveryId, context]);

  useEffect(() => { loadCaptureEvidence(); }, [loadCaptureEvidence]);

  useEffect(() => {
    if (!discoveryId) return;
    api.questions.list(discoveryId, "orient").then((sets) => {
      setSavedQuestionSets(sets);
      if (sets.length > 0 && questions.length === 0) {
        const latest = sets[sets.length - 1];
        setQuestions(latest.questions);
        if (latest.context) setContext(latest.context);
      }
    }).catch(() => { /* non-critical */ });
  }, [discoveryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateQuestions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.questions.generate({ discovery_id: discoveryId, phase: "orient", context });
      setQuestions(result.questions);
      setSavedQuestionSets((prev) => [...prev, result]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  };

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <Compass className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Select or create a discovery from the Dashboard to start orienting.</p>
      </div>
    );
  }

  return (
    <PhaseShell phase="orient" discoveryId={discoveryId}>
      <Tabs defaultValue="sensemaking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sensemaking" className="gap-1.5">
            <Network className="h-3.5 w-3.5" />
            Sensemaking
          </TabsTrigger>
          <TabsTrigger value="problem" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Problem Statement
          </TabsTrigger>
          <TabsTrigger value="usecase" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Use Case
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sensemaking" className="space-y-4">
          {captureEvidence.length > 0 && (
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-700">
                  Capture Evidence Loaded
                  <Badge variant="secondary" className="ml-2">{captureEvidence.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Evidence from the Capture phase has been loaded into context below.
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orient Context</CardTitle>
              <CardDescription>
                What evidence have you captured? The AI will generate sensemaking questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., We interviewed 5 portfolio managers. Common themes: slow trade execution, duplicate reconciliation, workarounds for compliance reporting."
                rows={4}
              />
              <Button onClick={generateQuestions} disabled={generating}>
                {generating ? "Generating..." : "Generate Orient Questions"}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </CardContent>
          </Card>

          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Sensemaking Questions
                  <Badge variant="secondary" className="ml-2">{questions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((q, i) => (
                  <div key={i}>
                    <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigator.clipboard.writeText(q.text)}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{q.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">Purpose: {q.purpose}</p>
                      </div>
                    </div>
                    {i < questions.length - 1 && <Separator className="mt-2" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="problem">
          <ProblemStatementBuilder discoveryId={discoveryId} activeDiscovery={activeDiscovery} />
        </TabsContent>

        <TabsContent value="usecase">
          <UseCaseBuilder discoveryId={discoveryId} activeDiscovery={activeDiscovery} />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
