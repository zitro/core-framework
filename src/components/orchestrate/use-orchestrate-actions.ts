"use client";

import type { Evidence } from "@/types/core";
import { api } from "@/lib/api";
import {
  DEFAULT_QUESTION_COUNT,
  getQuestionResolutionBucket,
  INTRO_CALL_CONTEXT_TEMPLATE,
  STARTER_INTRO_QUESTIONS,
} from "@/components/orchestrate/orchestrate-constants";
import type { OrchestrateState } from "@/components/orchestrate/use-orchestrate-state";

export function useOrchestrateActions(state: OrchestrateState, setActiveTab: (tab: string) => void) {
  const {
    discoveryId,
    questions,
    setQuestions,
    setSavedQuestionSets,
    setContext,
    workingNotes,
    setWorkingNotes,
    setShortcutMessage,
    setShowFocusedSections,
    questionComments,
    setQuestionComments,
    questionInstructions,
    setQuestionInstructions,
    setAttachingQuestionEvidence,
    setGenerating,
    setSavingComments,
    setError,
    setUsingStarterQuestions,
    setSavedAnalyses,
    selectedTranscript,
    setAnalysisResult,
    setExtractedTranscriptEvidence,
    setAnalyzingTranscript,
    analysisNotes,
    setAnalysisNotes,
    contextTextareaRef,
    generationContext,
  } = state;

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
        savedAnswerBlocks.push(
          [`Question: ${q.text}`, instruction ? `AI direction: ${instruction}` : "", `Answer: ${answer}`].filter(Boolean).join("\n"),
        );
      }
      if (savedAnswerBlocks.length > 0) {
        setContext((prev) =>
          [prev.trim(), `Resolved Orchestrate questions:\n${savedAnswerBlocks.join("\n\n")}`].filter(Boolean).join("\n\n"),
        );
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
        insights: result.insights.map((insight) => ({ text: insight.text, confidence: insight.confidence })),
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
      setContext((prev) =>
        [prev.trim(), `Evidence attached for question:\n${question.text}\nFiles: ${fileNames.join(", ")}`]
          .filter(Boolean)
          .join("\n\n"),
      );
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

  return {
    generateQuestions,
    saveQuestionAnswersAsEvidence,
    analyzeSelectedTranscript,
    addAnalysisNotesToContext,
    applyIntroCallTemplate,
    attachQuestionEvidence,
    loadStarterQuestions,
    appendTopicBlock,
    addWorkingNotesToContext,
  };
}
