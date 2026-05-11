"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Briefcase,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Cpu,
  FilePlus2,
  FileText,
  ListChecks,
  Network,
  Paperclip,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wand2,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Evidence, Question, QuestionSet, TranscriptAnalysis } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";
import { DiscoveryRequired } from "@/components/layout/discovery-required";
import { AiFeedback } from "@/components/orchestrate/ai-feedback";
import { GroundedPanel } from "@/components/orchestrate/grounded-panel";
import { NarrativePanel } from "@/components/orchestrate/narrative-panel";
import { useTabParam } from "@/lib/use-tab-param";
import { ProblemStatementBuilder } from "@/components/orchestrate/problem-statement-builder";
import { UseCaseBuilder } from "@/components/orchestrate/use-case-builder";
import { ContextBriefBuilder } from "@/components/orchestrate/context-brief-builder";
import {
  TranscriptAnalysisResult,
  type AnalysisSummary,
} from "@/components/capture/transcript-analysis-result";
import { PreviousAnalysesList } from "@/components/capture/previous-analyses-list";

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

const DEFAULT_QUESTION_COUNT = 10;

const TOPIC_INSERTS: { label: string; description: string; body: string; icon: LucideIcon }[] = [
  {
    label: "Stakeholders",
    description: "Owners, sponsors, decision makers, and working team.",
    body: "Stakeholders and ownership:\n- Primary sponsor:\n- Business owner:\n- Technical owner:\n- Decision maker:\n- Working team:",
    icon: Users,
  },
  {
    label: "Current Process",
    description: "Workflow, delays, handoffs, and what works today.",
    body: "How work is done today:\n- Current workflow steps:\n- Pain points / delays:\n- Workarounds in place:\n- What is currently working well:",
    icon: Workflow,
  },
  {
    label: "Technology Landscape",
    description: "Platforms, integrations, data, identity, and constraints.",
    body: "Technology landscape:\n- Core platforms in use:\n- Key integrations/dependencies:\n- Data and identity constraints:\n- Observability/security requirements:",
    icon: Cpu,
  },
  {
    label: "Approvals + Environment",
    description: "Governance, setup path, lead times, and blockers.",
    body: "Approvals and environment setup:\n- Required approvals (security, compliance, architecture, procurement):\n- Environment setup process:\n- Typical lead times:\n- Blockers and escalation path:",
    icon: ShieldCheck,
  },
  {
    label: "Use Case + Value",
    description: "Initial use case, outcomes, metrics, and urgency.",
    body: "Use case and value:\n- Initial use case:\n- Desired outcomes:\n- Success metrics:\n- Timeline pressure / constraints:",
    icon: Target,
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
  {
    text: "What data, reports, or artifacts would help us understand the current state faster?",
    purpose: "Identify the source material needed to ground synthesis.",
    follow_ups: [
      "Which artifacts are trustworthy and current?",
      "Who owns access to those sources?",
    ],
  },
  {
    text: "What risks or dependencies could prevent progress after this first discovery session?",
    purpose: "Surface blockers that should shape the next working plan.",
    follow_ups: [
      "Which dependency has the longest lead time?",
      "Who can remove or escalate that blocker?",
    ],
  },
];

type QuestionResolutionBucket = "planning" | "understanding";
type QuestionResolutionEntry = { question: Question; index: number };
const PLANNING_QUESTION_PATTERN = /\b(plan|planning|next|owner|owns|decision|approve|approval|governance|timeline|milestone|success|scope|use case|business value|sponsor|involved|execution|adoption|environment)\b/i;

const getQuestionResolutionBucket = (question: Question): QuestionResolutionBucket => {
  const text = `${question.text} ${question.purpose}`;
  return PLANNING_QUESTION_PATTERN.test(text) ? "planning" : "understanding";
};

const previewContextBasis = (value: string) => {
  const firstMeaningfulLine = value
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .find(Boolean);
  if (!firstMeaningfulLine) return "Current Orchestrate context";
  const label = firstMeaningfulLine.replace(/:$/, "");
  return label.length > 96 ? `${label.slice(0, 96)}...` : label;
};

const formatEvidenceType = (value: string) => value.replace("_", " ");

export default function OrchestratePage() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuestionSets, setSavedQuestionSets] = useState<QuestionSet[]>([]);
  const [activeTab, setActiveTab] = useTabParam("overview");
  const [context, setContext] = useState("");
  const [workingNotes, setWorkingNotes] = useState("");
  const [shortcutMessage, setShortcutMessage] = useState("");
  const [showFocusedSections, setShowFocusedSections] = useState(false);
  const [questionComments, setQuestionComments] = useState<Record<number, string>>({});
  const [questionInstructions, setQuestionInstructions] = useState<Record<number, string>>({});
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [attachingQuestionEvidence, setAttachingQuestionEvidence] = useState<Record<number, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [savingComments, setSavingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<Evidence[]>([]);
  const [usingStarterQuestions, setUsingStarterQuestions] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<TranscriptAnalysis[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisSummary | null>(null);
  const [extractedTranscriptEvidence, setExtractedTranscriptEvidence] = useState<Evidence[]>([]);
  const [analyzingTranscript, setAnalyzingTranscript] = useState(false);
  const [analysisNotes, setAnalysisNotes] = useState("");
  const contextTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transcriptEvidence = useMemo(
    () =>
      captureEvidence.filter((item) =>
        item.tags.includes("transcript") || item.source.toLowerCase().includes("transcript"),
      ),
    [captureEvidence],
  );

  const selectedTranscript = useMemo(
    () => transcriptEvidence.find((item) => item.id === selectedTranscriptId) ?? transcriptEvidence[0],
    [selectedTranscriptId, transcriptEvidence],
  );

  const questionBuckets = useMemo(() => {
    const buckets: Record<QuestionResolutionBucket | "answered", QuestionResolutionEntry[]> = {
      planning: [],
      understanding: [],
      answered: [],
    };

    questions.forEach((question, index) => {
      const entry = { question, index };
      if (questionComments[index]?.trim()) {
        buckets.answered.push(entry);
        return;
      }
      buckets[getQuestionResolutionBucket(question)].push(entry);
    });

    return buckets;
  }, [questionComments, questions]);

  const activeQuestionSet = useMemo(() => savedQuestionSets.at(-1), [savedQuestionSets]);

  const questionEntries = useMemo<QuestionResolutionEntry[]>(
    () => questions.map((question, index) => ({ question, index })),
    [questions],
  );

  const activeQuestionEntry = useMemo(() => {
    if (questionEntries.length === 0) return null;
    if (selectedQuestionIndex !== null) {
      const selected = questionEntries.find((entry) => entry.index === selectedQuestionIndex);
      if (selected) return selected;
    }
    return questionBuckets.understanding[0] ?? questionBuckets.planning[0] ?? questionBuckets.answered[0] ?? questionEntries[0];
  }, [questionBuckets.answered, questionBuckets.planning, questionBuckets.understanding, questionEntries, selectedQuestionIndex]);

  const questionDisplayNumberByIndex = useMemo(() => {
    const displayOrder = [
      ...questionBuckets.understanding,
      ...questionBuckets.planning,
      ...questionBuckets.answered,
    ];
    return new Map(displayOrder.map((entry, displayIndex) => [entry.index, displayIndex + 1]));
  }, [questionBuckets.answered, questionBuckets.planning, questionBuckets.understanding]);

  const activeQuestionDisplayNumber = activeQuestionEntry
    ? questionDisplayNumberByIndex.get(activeQuestionEntry.index) ?? activeQuestionEntry.index + 1
    : 0;

  const questionContextBasis = useMemo(() => {
    if (usingStarterQuestions) return "Intro call starter set";
    return previewContextBasis(activeQuestionSet?.context || context);
  }, [activeQuestionSet?.context, context, usingStarterQuestions]);

  const groundingQueries = useMemo(() => {
    return Array.from(new Set((activeQuestionSet?.grounding_sources ?? []).map((source) => source.query))).slice(0, 3);
  }, [activeQuestionSet?.grounding_sources]);

  const targetTechnologies = useMemo(() => {
    const structured = activeDiscovery?.target_technologies ?? [];
    if (structured.length > 0) return structured;
    return (activeDiscovery?.solution_providers ?? []).map((name) => ({ name, focus: "" }));
  }, [activeDiscovery?.solution_providers, activeDiscovery?.target_technologies]);

  const captureSources = useMemo(() => activeDiscovery?.engagement_sources ?? [], [activeDiscovery?.engagement_sources]);

  const captureContextSummary = useMemo(() => {
    const parts: string[] = [];
    if (captureEvidence.length > 0) {
      parts.push(
        "Capture intake from Capture phase:",
        ...captureEvidence.map((item) => {
          const tags = item.tags.length > 0 ? ` [${item.tags.join(", ")}]` : "";
          const source = item.source ? ` (${item.source})` : "";
          return `- ${formatEvidenceType(item.evidence_type)}${source}${tags}: ${item.content}`;
        }),
      );
    }
    if (targetTechnologies.length > 0) {
      parts.push(
        "Target technologies captured:",
        ...targetTechnologies.map((target) => `- ${target.name}${target.focus ? `: ${target.focus}` : ""}`),
      );
    }
    if (captureSources.length > 0) {
      parts.push(
        "Connected Capture sources:",
        ...captureSources.map((source) => `- ${source.type}: ${source.value}`),
      );
    }
    return parts.join("\n");
  }, [captureEvidence, captureSources, targetTechnologies]);

  const contextIncludesCapture = context.includes("Capture intake from Capture phase:");

  const generationContext = useMemo(() => {
    return [contextIncludesCapture ? "" : captureContextSummary, context.trim()]
      .filter(Boolean)
      .join("\n\nOrchestrate working context:\n");
  }, [captureContextSummary, context, contextIncludesCapture]);

  const showTranscriptWorkspace = transcriptEvidence.length > 0 || savedAnalyses.length > 0 || Boolean(analysisResult);

  const previewText = (value: string) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 260 ? `${normalized.slice(0, 260)}...` : normalized;
  };

  const loadCaptureEvidence = useCallback(async () => {
    if (!discoveryId) return [];
    const items = await api.evidence.list(discoveryId, "capture");
    setCaptureEvidence(items);
    return items;
  }, [discoveryId]);

  useEffect(() => {
    loadCaptureEvidence().catch(() => { /* non-critical */ });
  }, [loadCaptureEvidence]);

  useEffect(() => {
    if (!discoveryId) return;
    api.transcripts.list(discoveryId).then(setSavedAnalyses).catch(() => { /* non-critical */ });
  }, [discoveryId]);

  useEffect(() => {
    if (!selectedTranscriptId && transcriptEvidence.length > 0) {
      setSelectedTranscriptId(transcriptEvidence[0].id);
    }
  }, [selectedTranscriptId, transcriptEvidence]);

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

  useEffect(() => {
    if (questions.length === 0) {
      setSelectedQuestionIndex(null);
      return;
    }
    setSelectedQuestionIndex((current) => {
      if (current !== null && questions[current]) return current;
      return questionBuckets.understanding[0]?.index ?? questionBuckets.planning[0]?.index ?? questionBuckets.answered[0]?.index ?? 0;
    });
  }, [questionBuckets.answered, questionBuckets.planning, questionBuckets.understanding, questions]);

  const generateQuestions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.questions.generate({
        discovery_id: discoveryId,
        phase: "orchestrate",
        context: generationContext,
        num_questions: DEFAULT_QUESTION_COUNT,
      });
      setQuestions(result.questions);
      setSavedQuestionSets((prev) => [...prev, result]);
      setUsingStarterQuestions(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  };

  const saveQuestionAnswersAsEvidence = async () => {
    if (!discoveryId) return;
    const commentEntries = Object.entries(questionComments).filter(([, value]) => value.trim());
    if (commentEntries.length === 0) return;

    setSavingComments(true);
    setError(null);
    const savedAnswerBlocks: string[] = [];
    try {
      for (const [index, note] of commentEntries) {
        const q = questions[Number(index)];
        if (!q) continue;
        const bucket = getQuestionResolutionBucket(q);
        const answer = note.trim();
        const instruction = questionInstructions[Number(index)]?.trim();
        await api.evidence.create({
          discovery_id: discoveryId,
          phase: "orchestrate",
          source: bucket === "planning" ? "Planning question answer" : "Understanding gap answer",
          content: [
            `Question: ${q.text}`,
            instruction ? `AI direction: ${instruction}` : "",
            `Answer: ${answer}`,
          ].filter(Boolean).join("\n"),
          evidence_type: "insight",
          tags: ["questions-to-resolve", bucket === "planning" ? "planning-question" : "understanding-gap", "answered"],
        });
        savedAnswerBlocks.push([`Question: ${q.text}`, instruction ? `AI direction: ${instruction}` : "", `Answer: ${answer}`].filter(Boolean).join("\n"));
      }
      if (savedAnswerBlocks.length > 0) {
        setContext((prev) => [prev.trim(), `Resolved Orchestrate questions:\n${savedAnswerBlocks.join("\n\n")}`].filter(Boolean).join("\n\n"));
      }
      setQuestionComments({});
      setQuestionInstructions({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save question answers");
    } finally {
      setSavingComments(false);
    }
  };

  const analyzeSelectedTranscript = async () => {
    if (!discoveryId || !selectedTranscript) return;
    setAnalyzingTranscript(true);
    setError(null);
    try {
      const result = await api.transcripts.analyze({
        discovery_id: discoveryId,
        transcript_text: selectedTranscript.content,
      });
      setSavedAnalyses((prev) => [...prev, result]);
      setAnalysisResult({
        insights: result.insights.map((insight) => ({
          text: insight.text,
          confidence: insight.confidence,
        })),
        key_themes: result.key_themes,
        sentiment: result.sentiment,
      });

      const savedEvidence: Evidence[] = [];
      for (const item of result.evidence_extracted ?? []) {
        try {
          const created = await api.evidence.create({
            discovery_id: discoveryId,
            phase: "orchestrate",
            content: item.content,
            source: selectedTranscript.source || "Transcript analysis",
            confidence: item.confidence || "unknown",
            evidence_type: item.evidence_type || "insight",
            tags: Array.from(new Set([...(item.tags ?? []), "transcript-analysis"])),
          });
          savedEvidence.push(created);
        } catch {
          /* skip individual evidence save failures */
        }
      }
      setExtractedTranscriptEvidence(savedEvidence);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze transcript");
    } finally {
      setAnalyzingTranscript(false);
    }
  };

  const addAnalysisNotesToContext = () => {
    const notes = analysisNotes.trim();
    if (!notes) return;
    setContext((prev) =>
      [prev.trim(), `Transcript analysis review notes:\n${notes}`].filter(Boolean).join("\n\n"),
    );
    setAnalysisNotes("");
  };

  // Auto-bootstrap removed: it silently fired api.questions.generate,
  // api.problemStatements.generate, and api.useCases.generate on every
  // mount, all of which hit LLM-backed endpoints that 502 without a
  // provider configured (the v1.3.1 default). Users now click the
  // explicit Generate buttons in each section to start a generation.

  const applyIntroCallTemplate = () => {
    setContext(INTRO_CALL_CONTEXT_TEMPLATE);
    setShowFocusedSections(true);
    setShortcutMessage("Intro call template added to Working Material.");
    window.requestAnimationFrame(() => contextTextareaRef.current?.focus());
  };

  const attachQuestionEvidence = async (questionIndex: number, files: FileList | null) => {
    if (!discoveryId || !files || files.length === 0) return;
    const question = questions[questionIndex];
    if (!question) return;
    setAttachingQuestionEvidence((prev) => ({ ...prev, [questionIndex]: true }));
    setError(null);
    const fileNames = Array.from(files).map((file) => file.name);
    try {
      for (const file of Array.from(files)) {
        await api.evidence.upload({
          discovery_id: discoveryId,
          phase: "orchestrate",
          source: `Question evidence: ${question.text}`,
          evidence_type: "general",
          note: [
            `Attached to question: ${question.text}`,
            questionInstructions[questionIndex]?.trim() ? `AI direction: ${questionInstructions[questionIndex].trim()}` : "",
          ].filter(Boolean).join("\n"),
          tags: ["questions-to-resolve", "question-evidence", getQuestionResolutionBucket(question)],
          file,
        });
      }
      setContext((prev) => [
        prev.trim(),
        `Evidence attached for question:\n${question.text}\nFiles: ${fileNames.join(", ")}`,
      ].filter(Boolean).join("\n\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to attach question evidence");
    } finally {
      setAttachingQuestionEvidence((prev) => ({ ...prev, [questionIndex]: false }));
    }
  };

  const loadStarterQuestions = () => {
    setQuestions(STARTER_INTRO_QUESTIONS);
    setUsingStarterQuestions(true);
    setShowFocusedSections(true);
    setActiveTab("questions");
  };

  const appendTopicBlock = (label: string, body: string) => {
    setContext((prev) => {
      if (!prev.trim()) return body;
      return `${prev.trim()}\n\n${body}`;
    });
    setShortcutMessage(`${label} section added to Working Material.`);
    window.requestAnimationFrame(() => contextTextareaRef.current?.focus());
  };

  const addWorkingNotesToContext = () => {
    const notes = workingNotes.trim();
    if (!notes) return;
    setContext((prev) => [prev.trim(), notes].filter(Boolean).join("\n\n"));
    setWorkingNotes("");
    window.requestAnimationFrame(() => contextTextareaRef.current?.focus());
  };

  const renderQuestionQueueGroup = (title: string, entries: QuestionResolutionEntry[], emptyText: string) => {
    if (entries.length === 0) {
      return (
        <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
          {emptyText}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
          <span className="text-xs text-muted-foreground">{entries.length}</span>
        </div>
        {entries.map(({ question, index }) => (
          <button
            key={`${question.text}:${index}`}
            type="button"
            onClick={() => setSelectedQuestionIndex(index)}
            className={`w-full rounded-md border p-3 text-left transition-colors ${
              activeQuestionEntry?.index === index ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"
            }`}
          >
            <span className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                {questionDisplayNumberByIndex.get(index) ?? index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">{question.text}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{question.purpose}</span>
              </span>
            </span>
            {questionComments[index]?.trim() && (
              <span className="mt-2 block text-xs font-medium text-brand">
                Answer drafted
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  if (!activeDiscovery) {
    return <DiscoveryRequired phase="orchestrate" />;
  }

  return (
    <PhaseShell
      phase="orchestrate"
      discoveryId={discoveryId}
      showEvidencePanel={false}
      showDtMethodsPanel={false}
    >
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <TabsTrigger value="overview" className="gap-1.5">
              <Network className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5">
              <CircleHelp className="h-3.5 w-3.5" />
              Questions
            </TabsTrigger>
            {showTranscriptWorkspace && (
              <TabsTrigger value="transcripts" className="gap-1.5">
                <AudioLines className="h-3.5 w-3.5" />
                Transcripts
              </TabsTrigger>
            )}
            <TabsTrigger value="drafts" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Drafts
            </TabsTrigger>
            <TabsTrigger value="narrative" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Narrative
            </TabsTrigger>
            <TabsTrigger value="grounded" className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              Grounded
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.75fr)]">
              <div className="space-y-4">
                <ContextBriefBuilder
                  discoveryId={discoveryId}
                  context={context}
                  onContextChange={setContext}
                  workingNotes={workingNotes}
                  onWorkingNotesChange={setWorkingNotes}
                  onAddWorkingNotes={addWorkingNotesToContext}
                  contextTextareaRef={contextTextareaRef}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Session Starters
                    </CardTitle>
                    <CardDescription>
                      Add useful structure to Working Material or open a starter question queue.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal p-3 text-left"
                        onClick={applyIntroCallTemplate}
                      >
                        <FilePlus2 className="mr-3 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">Intro Call Template</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            Populate Working Material with a complete discovery-call outline.
                          </span>
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal p-3 text-left"
                        onClick={loadStarterQuestions}
                      >
                        <ListChecks className="mr-3 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">Starter Questions</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            Open a ready-made question queue for an intro discovery call.
                          </span>
                        </span>
                      </Button>
                    </div>

                    {shortcutMessage && (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                        <span>{shortcutMessage}</span>
                      </div>
                    )}

                    {showFocusedSections && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Add a focused section</p>
                        {TOPIC_INSERTS.map((topic) => {
                          const TopicIcon = topic.icon;
                          return (
                            <button
                              key={topic.label}
                              type="button"
                              className="flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => appendTopicBlock(topic.label, topic.body)}
                            >
                              <TopicIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium leading-snug">{topic.label}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                  {topic.description}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CircleHelp className="h-4 w-4" />
                      Questions to Resolve
                      <Badge variant="secondary">{questions.length}</Badge>
                      {usingStarterQuestions && <Badge variant="outline" className="text-[10px]">Starter set</Badge>}
                    </CardTitle>
                    <CardDescription>
                      Planning prompts and understanding gaps generated from Capture intake and Orchestrate context.
                    </CardDescription>
                  </div>
                  <Button onClick={generateQuestions} disabled={generating} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {generating ? "Generating..." : "Regenerate From Capture + Context"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted/20 px-4 py-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Basis</p>
                      <p className="mt-1 truncate text-sm font-medium">{questionContextBasis}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{captureEvidence.length} Capture items</span>
                      <span>{targetTechnologies.length} technologies</span>
                      <span>{groundingQueries.length > 0 ? "Research grounded" : "Context grounded"}</span>
                    </div>
                  </div>
                </div>

                {questions.length > 0 ? (
                  <>
                    <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
                      <div className="rounded-md border bg-muted/10">
                        <div className="border-b px-4 py-3">
                          <p className="text-sm font-semibold">Question Queue</p>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-md border bg-background px-2 py-2">
                              <p className="text-base font-semibold">{questionBuckets.understanding.length}</p>
                              <p className="text-muted-foreground">Clarify</p>
                            </div>
                            <div className="rounded-md border bg-background px-2 py-2">
                              <p className="text-base font-semibold">{questionBuckets.planning.length}</p>
                              <p className="text-muted-foreground">Plan</p>
                            </div>
                            <div className="rounded-md border bg-background px-2 py-2">
                              <p className="text-base font-semibold">{questionBuckets.answered.length}</p>
                              <p className="text-muted-foreground">Drafted</p>
                            </div>
                          </div>
                        </div>
                        <div className="max-h-[720px] space-y-4 overflow-auto p-3">
                          {renderQuestionQueueGroup("Clarify Understanding", questionBuckets.understanding, "No understanding gaps in this set.")}
                          {renderQuestionQueueGroup("Plan Work", questionBuckets.planning, "No planning prompts in this set.")}
                          {questionBuckets.answered.length > 0 && renderQuestionQueueGroup("Answer Drafts", questionBuckets.answered, "")}
                        </div>
                      </div>

                      {activeQuestionEntry && (
                        <div className="rounded-md border bg-background">
                          <div className="border-b px-5 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  Active Question {activeQuestionDisplayNumber} of {questions.length}
                                </p>
                                <h3 className="text-lg font-semibold leading-snug">{activeQuestionEntry.question.text}</h3>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="shrink-0"
                                onClick={() => navigator.clipboard.writeText(activeQuestionEntry.question.text)}
                              >
                                Copy Question
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-5 p-5">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border bg-muted/20 p-3">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Purpose</p>
                                <p className="mt-1 text-sm leading-relaxed">{activeQuestionEntry.question.purpose}</p>
                              </div>
                              <div className="rounded-md border bg-muted/20 p-3">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Classification</p>
                                <p className="mt-1 text-sm leading-relaxed">
                                  {getQuestionResolutionBucket(activeQuestionEntry.question) === "planning" ? "Plan work" : "Clarify understanding"}
                                </p>
                              </div>
                            </div>

                            {activeQuestionEntry.question.follow_ups.length > 0 && (
                              <div className="rounded-md border p-3">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Follow-Up Prompts</p>
                                <ol className="mt-2 space-y-2 text-sm">
                                  {activeQuestionEntry.question.follow_ups.map((followUp, followUpIndex) => (
                                    <li key={followUp} className="flex gap-2 leading-relaxed">
                                      <span className="text-muted-foreground">{followUpIndex + 1}.</span>
                                      <span>{followUp}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Answer or Decision</p>
                                <Textarea
                                  value={questionComments[activeQuestionEntry.index] || ""}
                                  onChange={(e) => setQuestionComments((prev) => ({ ...prev, [activeQuestionEntry.index]: e.target.value }))}
                                  placeholder="Answer, owner, next step, or clarification to save back into context..."
                                  rows={6}
                                />
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">AI Direction</p>
                                <Textarea
                                  value={questionInstructions[activeQuestionEntry.index] || ""}
                                  onChange={(e) => setQuestionInstructions((prev) => ({ ...prev, [activeQuestionEntry.index]: e.target.value }))}
                                  placeholder="Tell AI how to rework, focus, challenge, or use evidence for this question..."
                                  rows={6}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
                              <div>
                                <p className="text-sm font-medium">Evidence for this question</p>
                                <p className="text-xs text-muted-foreground">Attach files only to the selected question.</p>
                              </div>
                              <label
                                htmlFor={`question-evidence-${activeQuestionEntry.index}`}
                                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
                              >
                                <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                                {attachingQuestionEvidence[activeQuestionEntry.index] ? "Attaching..." : "Attach Evidence"}
                              </label>
                              <input
                                id={`question-evidence-${activeQuestionEntry.index}`}
                                type="file"
                                multiple
                                className="hidden"
                                aria-label="Attach evidence to this question"
                                onChange={(event) => void attachQuestionEvidence(activeQuestionEntry.index, event.target.files)}
                                disabled={attachingQuestionEvidence[activeQuestionEntry.index]}
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                onClick={saveQuestionAnswersAsEvidence}
                                disabled={savingComments || questionBuckets.answered.length === 0}
                              >
                                {savingComments ? "Saving..." : "Save Drafted Answers"}
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                Saves drafted answers into Orchestrate evidence and adds them to Working Material.
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                    No questions generated yet. Generate from Capture intake and Working Material to start resolving planning prompts and understanding gaps.
                  </div>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {showTranscriptWorkspace && (
            <TabsContent value="transcripts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AudioLines className="h-4 w-4" />
                    Transcript Analysis
                  </CardTitle>
                  <CardDescription>
                    Analyze raw transcripts captured upstream, then fold judgment, pushback, and refinements into Orchestrate context.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {transcriptEvidence.length > 0 && (
                    <>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {transcriptEvidence.map((item) => {
                          const active = selectedTranscript?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedTranscriptId(item.id)}
                              className={`rounded-md border p-3 text-left transition-colors ${
                                active ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"
                              }`}
                            >
                              <span className="block text-sm font-medium">{item.source || "Transcript"}</span>
                              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                {previewText(item.content)}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={analyzeSelectedTranscript} disabled={analyzingTranscript || !selectedTranscript} className="gap-2">
                          <Sparkles className="h-4 w-4" />
                          {analyzingTranscript ? "Analyzing..." : "Analyze Selected Transcript"}
                        </Button>
                        <Badge variant="secondary">Captured transcripts: {transcriptEvidence.length}</Badge>
                        <Badge variant="outline">Saved analyses: {savedAnalyses.length}</Badge>
                      </div>
                    </>
                  )}

                  {analysisResult && (
                    <TranscriptAnalysisResult result={analysisResult} extractedEvidence={extractedTranscriptEvidence} />
                  )}

                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-sm font-medium">Analysis review notes</p>
                    <Textarea
                      value={analysisNotes}
                      onChange={(e) => setAnalysisNotes(e.target.value)}
                      placeholder="Add your opinion, corrections, pushback, or refinement notes for this transcript analysis..."
                      rows={3}
                    />
                    <Button variant="outline" onClick={addAnalysisNotesToContext} disabled={!analysisNotes.trim()}>
                      Add Analysis Notes To Context
                    </Button>
                  </div>

                  <PreviousAnalysesList analyses={savedAnalyses} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="drafts" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Working synthesis drafts. Refine is where final statements get hardened.
            </p>
            <Tabs defaultValue="problem" className="space-y-4">
              <TabsList variant="line" className="gap-3 border-b">
                <TabsTrigger value="problem" className="gap-1.5">
                  <Route className="h-3.5 w-3.5" />
                  Problem Frame
                </TabsTrigger>
                <TabsTrigger value="usecase" className="gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Use Case
                </TabsTrigger>
              </TabsList>
              <TabsContent value="problem" className="space-y-4">
                <ProblemStatementBuilder discoveryId={discoveryId} activeDiscovery={activeDiscovery} />
                <AiFeedback discoveryId={discoveryId} surface="problem" />
              </TabsContent>
              <TabsContent value="usecase" className="space-y-4">
                <UseCaseBuilder discoveryId={discoveryId} />
                <AiFeedback discoveryId={discoveryId} surface="usecase" />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="narrative" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              The discovery as a continuous story. Audience, style, and focus shape the same source material —
              regenerate any time the underlying evidence changes.
            </p>
            <NarrativePanel discovery={activeDiscovery} />
            <AiFeedback discoveryId={discoveryId} surface="narrative" />
          </TabsContent>

          <TabsContent value="grounded" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Ask a question and get a grounded answer with inline citations, pulled from M365 search.
            </p>
            <GroundedPanel discoveryId={discoveryId} />
            <AiFeedback discoveryId={discoveryId} surface="grounded" />
          </TabsContent>
        </Tabs>
      </div>
    </PhaseShell>
  );
}
