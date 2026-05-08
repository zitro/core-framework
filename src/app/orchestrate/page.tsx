"use client";

import { useCallback, useEffect, useState } from "react";
import { Compass, Network, FileText, Briefcase, ClipboardList, Sparkles } from "lucide-react";
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
import { ProblemStatementBuilder } from "@/components/orchestrate/problem-statement-builder";
import { UseCaseBuilder } from "@/components/orchestrate/use-case-builder";

const INTRO_CALL_CONTEXT_TEMPLATE = `Meeting type: Intro discovery call
Goal: Introduce teams and understand the customer's current state before solutioning.

Capture:
- Customer goals and desired outcomes
- How work is done today (current process and pain points)
- Existing technologies/platforms and key integrations
- Environment setup path, prerequisites, and internal ownership
- Required approvals/governance and expected lead times
- Initial use case scope, business value, and success measures
- Risks, assumptions, dependencies, and open questions

Please generate practical questions to uncover unknowns and clarify next steps.`;

const TOPIC_INSERTS: { label: string; body: string }[] = [
  {
    label: "Customer intros + stakeholders",
    body: "Stakeholders and ownership:\n- Primary sponsor:\n- Business owner:\n- Technical owner:\n- Decision maker:\n- Working team:",
  },
  {
    label: "Current process",
    body: "How work is done today:\n- Current workflow steps:\n- Pain points / delays:\n- Workarounds in place:\n- What is currently working well:",
  },
  {
    label: "Technology landscape",
    body: "Technology landscape:\n- Core platforms in use:\n- Key integrations/dependencies:\n- Data and identity constraints:\n- Observability/security requirements:",
  },
  {
    label: "Approvals + environment",
    body: "Approvals and environment setup:\n- Required approvals (security, compliance, architecture, procurement):\n- Environment setup process:\n- Typical lead times:\n- Blockers and escalation path:",
  },
  {
    label: "Use case + business value",
    body: "Use case and value:\n- Initial use case:\n- Desired outcomes:\n- Success metrics:\n- Timeline pressure / constraints:",
  },
];

const STARTER_INTRO_QUESTIONS: { text: string; purpose: string; follow_ups: string[] }[] = [
  {
    text: "What outcomes are most important for this initiative in the next 90 days?",
    purpose: "Anchor discovery to measurable business outcomes.",
    follow_ups: [
      "How are you measuring success today?",
      "What would make this initiative feel successful to leadership?",
    ],
  },
  {
    text: "Can you walk us through how this process works today from start to finish?",
    purpose: "Understand the current-state operating flow.",
    follow_ups: [
      "Where do delays usually happen?",
      "Where do manual handoffs or rework occur?",
    ],
  },
  {
    text: "What are the top pain points your team is dealing with in the current approach?",
    purpose: "Identify friction and prioritize problem severity.",
    follow_ups: [
      "Which pain point has the highest business impact?",
      "Who experiences this pain most often?",
    ],
  },
  {
    text: "Which platforms and systems are critical to this workflow today?",
    purpose: "Map technology landscape and integration dependencies.",
    follow_ups: [
      "Which systems are hardest to integrate with?",
      "Any data quality or latency constraints we should know?",
    ],
  },
  {
    text: "What security, compliance, or architecture approvals are required before work can start?",
    purpose: "Surface governance process and potential delivery gates.",
    follow_ups: [
      "Who are the approvers and what artifacts do they need?",
      "What are typical approval lead times?",
    ],
  },
  {
    text: "How does environment setup happen in your organization today?",
    purpose: "Clarify environment provisioning flow and ownership.",
    follow_ups: [
      "Which team owns provisioning?",
      "What prerequisites tend to block setup?",
    ],
  },
  {
    text: "What is the first use case we should target for fastest business value?",
    purpose: "Prioritize an actionable initial use case.",
    follow_ups: [
      "What is in scope vs out of scope for this first step?",
      "What result would justify moving to phase two?",
    ],
  },
  {
    text: "Who needs to be involved for decisions, execution, and adoption?",
    purpose: "Map stakeholders, authority, and change-readiness.",
    follow_ups: [
      "Who is the executive sponsor?",
      "Who will use the solution day-to-day?",
    ],
  },
];

export default function OrchestratePage() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";
  const [questions, setQuestions] = useState<{ text: string; purpose: string; follow_ups: string[] }[]>([]);
  const [savedQuestionSets, setSavedQuestionSets] = useState<QuestionSet[]>([]);
  const [context, setContext] = useState("");
  const [workingNotes, setWorkingNotes] = useState("");
  const [questionComments, setQuestionComments] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [savingComments, setSavingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<Evidence[]>([]);
  const [usingStarterQuestions, setUsingStarterQuestions] = useState(false);

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
    api.questions.list(discoveryId, "orchestrate").then((sets) => {
      setSavedQuestionSets(sets);
      if (sets.length > 0 && questions.length === 0) {
        const latest = sets[sets.length - 1];
        setQuestions(latest.questions);
        setUsingStarterQuestions(false);
        if (latest.context) setContext(latest.context);
      } else if (sets.length === 0 && questions.length === 0) {
        setQuestions(STARTER_INTRO_QUESTIONS);
        setUsingStarterQuestions(true);
      }
    }).catch(() => { /* non-critical */ });
  }, [discoveryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateQuestions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.questions.generate({ discovery_id: discoveryId, phase: "orchestrate", context });
      setQuestions(result.questions);
      setSavedQuestionSets((prev) => [...prev, result]);
      setUsingStarterQuestions(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  };

  const saveCommentsAsEvidence = async () => {
    if (!discoveryId) return;
    const commentEntries = Object.entries(questionComments).filter(([, value]) => value.trim());
    if (commentEntries.length === 0) return;

    setSavingComments(true);
    setError(null);
    try {
      for (const [index, note] of commentEntries) {
        const q = questions[Number(index)];
        if (!q) continue;
        await api.evidence.create({
          discovery_id: discoveryId,
          phase: "orchestrate",
          source: "Orchestrate comments",
          content: `Question: ${q.text}\nComment: ${note.trim()}`,
        });
      }
      setQuestionComments({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save comments");
    } finally {
      setSavingComments(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!discoveryId || bootstrapping || savedQuestionSets.length > 0 || questions.length > 0) return;
      setBootstrapping(true);
      setError(null);
      try {
        const [problemVersions, useCaseVersions] = await Promise.all([
          api.problemStatements.list(discoveryId),
          api.useCases.list(discoveryId),
        ]);

        const seedContext = context.trim() || INTRO_CALL_CONTEXT_TEMPLATE;
        const generated = await api.questions.generate({
          discovery_id: discoveryId,
          phase: "orchestrate",
          context: seedContext,
        });
        setQuestions(generated.questions);
        setSavedQuestionSets((prev) => [...prev, generated]);
        setUsingStarterQuestions(false);

        const jobs: Promise<unknown>[] = [];
        if (problemVersions.length === 0) {
          jobs.push(api.problemStatements.generate({ discovery_id: discoveryId }));
        }
        if (useCaseVersions.length === 0) {
          jobs.push(api.useCases.generate({ discovery_id: discoveryId }));
        }
        if (jobs.length > 0) {
          await Promise.all(jobs);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to auto-generate orchestrate artifacts");
      } finally {
        setBootstrapping(false);
      }
    };

    void bootstrap();
  }, [bootstrapping, context, discoveryId, questions.length, savedQuestionSets.length]);

  const applyIntroCallTemplate = () => {
    setContext(INTRO_CALL_CONTEXT_TEMPLATE);
  };

  const loadStarterQuestions = () => {
    setQuestions(STARTER_INTRO_QUESTIONS);
    setUsingStarterQuestions(true);
  };

  const appendTopicBlock = (body: string) => {
    setContext((prev) => {
      if (!prev.trim()) return body;
      return `${prev.trim()}\n\n${body}`;
    });
  };

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <Compass className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Select or create a discovery from the Dashboard to start orchestrating.</p>
      </div>
    );
  }

  return (
    <PhaseShell phase="orchestrate" discoveryId={discoveryId}>
      <Tabs defaultValue="sensemaking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sensemaking" className="gap-1.5">
            <Network className="h-3.5 w-3.5" />
            Orchestrate
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
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1 border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                  Intro Call Playbook
                </CardTitle>
                <CardDescription>
                  Build meeting-ready orchestration context in minutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" variant="outline" className="w-full" onClick={applyIntroCallTemplate}>
                  Load Full Intro Call Template
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={loadStarterQuestions}>
                  Load Starter Questions
                </Button>
                <div className="space-y-2">
                  {TOPIC_INSERTS.map((topic) => (
                    <Button
                      key={topic.label}
                      type="button"
                      variant="ghost"
                      className="w-full justify-start text-xs"
                      onClick={() => appendTopicBlock(topic.body)}
                    >
                      + {topic.label}
                    </Button>
                  ))}
                </div>
                {captureEvidence.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Capture evidence ready: <span className="font-medium">{captureEvidence.length}</span> items loaded.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Orchestrate Context</CardTitle>
                <CardDescription>
                  Combine evidence, constraints, and goals. CORE will generate facilitation questions for this meeting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Current Process</Badge>
                  <Badge variant="outline">Technology Landscape</Badge>
                  <Badge variant="outline">Approvals & Governance</Badge>
                  <Badge variant="outline">Environment Setup</Badge>
                  <Badge variant="outline">Use Case & Business Value</Badge>
                </div>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., We interviewed 5 portfolio managers. Common themes: slow trade execution, duplicate reconciliation, workarounds for compliance reporting."
                  rows={10}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={generateQuestions} disabled={generating} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {generating ? "Generating..." : "Generate Orchestrate Questions"}
                  </Button>
                  <Badge variant="secondary">Saved sets: {savedQuestionSets.length}</Badge>
                  {bootstrapping && <Badge variant="outline">Auto-generating from capture data...</Badge>}
                </div>
                <Textarea
                  value={workingNotes}
                  onChange={(e) => setWorkingNotes(e.target.value)}
                  placeholder="Add notes from your customer conversation, then regenerate questions with this context."
                  rows={3}
                />
                <Button
                  variant="outline"
                  onClick={() => setContext((prev) => [prev.trim(), workingNotes.trim()].filter(Boolean).join("\n\n"))}
                  disabled={!workingNotes.trim()}
                >
                  Add Notes To Context
                </Button>
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              </CardContent>
            </Card>
          </div>

          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Orchestrate Questions
                  <Badge variant="secondary" className="ml-2">{questions.length}</Badge>
                  {usingStarterQuestions && (
                    <Badge variant="outline" className="ml-2 text-[10px]">Starter set</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Click a question to copy it for your live customer conversation.
                </CardDescription>
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
                        <Textarea
                          value={questionComments[i] || ""}
                          onChange={(e) => setQuestionComments((prev) => ({ ...prev, [i]: e.target.value }))}
                          placeholder="Your comment, edit, or pushback on this question..."
                          rows={2}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    {i < questions.length - 1 && <Separator className="mt-2" />}
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={saveCommentsAsEvidence}
                  disabled={savingComments}
                >
                  {savingComments ? "Saving..." : "Save Comments To Evidence"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="problem">
          <ProblemStatementBuilder discoveryId={discoveryId} activeDiscovery={activeDiscovery} />
        </TabsContent>

        <TabsContent value="usecase">
          <UseCaseBuilder discoveryId={discoveryId} />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
