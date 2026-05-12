"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Evidence, Question, QuestionSet, TranscriptAnalysis } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import type { AnalysisSummary } from "@/components/capture/transcript-analysis-result";
import {
  formatEvidenceType,
  getQuestionResolutionBucket,
  previewContextBasis,
  type QuestionResolutionBucket,
  type QuestionResolutionEntry,
  STARTER_INTRO_QUESTIONS,
} from "@/components/orchestrate/orchestrate-constants";

export function useOrchestrateState() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuestionSets, setSavedQuestionSets] = useState<QuestionSet[]>([]);
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

  const questionContextBasis = useMemo(() => {
    if (usingStarterQuestions) return "Intro call starter set";
    return previewContextBasis(activeQuestionSet?.context || context);
  }, [activeQuestionSet?.context, context, usingStarterQuestions]);

  const groundingQueries = useMemo(
    () => Array.from(new Set((activeQuestionSet?.grounding_sources ?? []).map((source) => source.query))).slice(0, 3),
    [activeQuestionSet?.grounding_sources],
  );

  const targetTechnologies = useMemo(() => {
    const structured = activeDiscovery?.target_technologies ?? [];
    if (structured.length > 0) return structured;
    return (activeDiscovery?.solution_providers ?? []).map((name) => ({ name, focus: "" }));
  }, [activeDiscovery?.solution_providers, activeDiscovery?.target_technologies]);

  const captureSources = useMemo(
    () => activeDiscovery?.engagement_sources ?? [],
    [activeDiscovery?.engagement_sources],
  );

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

  const generationContext = useMemo(
    () =>
      [contextIncludesCapture ? "" : captureContextSummary, context.trim()]
        .filter(Boolean)
        .join("\n\nOrchestrate working context:\n"),
    [captureContextSummary, context, contextIncludesCapture],
  );

  const showTranscriptWorkspace = transcriptEvidence.length > 0 || savedAnalyses.length > 0 || Boolean(analysisResult);

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

  return {
    activeDiscovery,
    discoveryId,
    questions,
    setQuestions,
    savedQuestionSets,
    setSavedQuestionSets,
    context,
    setContext,
    workingNotes,
    setWorkingNotes,
    shortcutMessage,
    setShortcutMessage,
    showFocusedSections,
    setShowFocusedSections,
    questionComments,
    setQuestionComments,
    questionInstructions,
    setQuestionInstructions,
    selectedQuestionIndex,
    setSelectedQuestionIndex,
    attachingQuestionEvidence,
    setAttachingQuestionEvidence,
    generating,
    setGenerating,
    savingComments,
    setSavingComments,
    error,
    setError,
    captureEvidence,
    usingStarterQuestions,
    setUsingStarterQuestions,
    savedAnalyses,
    setSavedAnalyses,
    selectedTranscriptId,
    setSelectedTranscriptId,
    analysisResult,
    setAnalysisResult,
    extractedTranscriptEvidence,
    setExtractedTranscriptEvidence,
    analyzingTranscript,
    setAnalyzingTranscript,
    analysisNotes,
    setAnalysisNotes,
    contextTextareaRef,
    transcriptEvidence,
    selectedTranscript,
    questionBuckets,
    activeQuestionEntry,
    questionDisplayNumberByIndex,
    questionContextBasis,
    groundingQueries,
    targetTechnologies,
    generationContext,
    showTranscriptWorkspace,
  };
}

export type OrchestrateState = ReturnType<typeof useOrchestrateState>;
