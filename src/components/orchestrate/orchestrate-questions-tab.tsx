"use client";

import type { Dispatch, SetStateAction } from "react";
import { CircleHelp, Paperclip, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getQuestionResolutionBucket,
  type QuestionResolutionEntry,
} from "@/components/orchestrate/orchestrate-constants";

type QuestionBuckets = {
  planning: QuestionResolutionEntry[];
  understanding: QuestionResolutionEntry[];
  answered: QuestionResolutionEntry[];
};

type Props = {
  questionsLength: number;
  usingStarterQuestions: boolean;
  generating: boolean;
  onGenerate: () => void;
  questionContextBasis: string;
  captureEvidenceCount: number;
  targetTechnologiesCount: number;
  groundingQueriesCount: number;
  questionBuckets: QuestionBuckets;
  activeQuestionEntry: QuestionResolutionEntry | null;
  questionDisplayNumberByIndex: Map<number, number>;
  selectedQuestionIndex: number | null;
  onSelectQuestionIndex: (index: number) => void;
  questionComments: Record<number, string>;
  setQuestionComments: Dispatch<SetStateAction<Record<number, string>>>;
  questionInstructions: Record<number, string>;
  setQuestionInstructions: Dispatch<SetStateAction<Record<number, string>>>;
  attachingQuestionEvidence: Record<number, boolean>;
  onAttachEvidence: (questionIndex: number, files: FileList | null) => void;
  savingComments: boolean;
  onSaveAnswers: () => void;
  error: string | null;
};

export function OrchestrateQuestionsTab({
  questionsLength,
  usingStarterQuestions,
  generating,
  onGenerate,
  questionContextBasis,
  captureEvidenceCount,
  targetTechnologiesCount,
  groundingQueriesCount,
  questionBuckets,
  activeQuestionEntry,
  questionDisplayNumberByIndex,
  onSelectQuestionIndex,
  questionComments,
  setQuestionComments,
  questionInstructions,
  setQuestionInstructions,
  attachingQuestionEvidence,
  onAttachEvidence,
  savingComments,
  onSaveAnswers,
  error,
}: Props) {
  function renderQueueGroup(title: string, entries: QuestionResolutionEntry[], emptyText: string) {
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
            onClick={() => onSelectQuestionIndex(index)}
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
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
            <CircleHelp className="h-4 w-4 text-muted-foreground" />
            Questions to Resolve
            <Badge variant="secondary">{questionsLength}</Badge>
            {usingStarterQuestions && (
              <Badge variant="outline" className="text-[10px]">
                Starter set
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Planning prompts and understanding gaps generated from Capture intake and Orchestrate context.
          </p>
        </div>
        <Button onClick={onGenerate} disabled={generating} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {generating ? "Generating…" : "Regenerate"}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Grounded on</span>
            <span className="truncate font-medium">{questionContextBasis}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{captureEvidenceCount} Capture items</span>
            <span>·</span>
            <span>{targetTechnologiesCount} technologies</span>
            <span>·</span>
            <span>{groundingQueriesCount > 0 ? "Research grounded" : "Context grounded"}</span>
          </div>
        </div>

        {questionsLength > 0 ? (
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
                {renderQueueGroup("Clarify Understanding", questionBuckets.understanding, "No understanding gaps in this set.")}
                {renderQueueGroup("Plan Work", questionBuckets.planning, "No planning prompts in this set.")}
                {questionBuckets.answered.length > 0 && renderQueueGroup("Answer Drafts", questionBuckets.answered, "")}
              </div>
            </div>

            {activeQuestionEntry && (
              <div className="rounded-md border bg-background">
                <div className="border-b px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 font-heading text-lg font-semibold leading-snug">
                      {activeQuestionEntry.question.text}
                    </h3>
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
                      onChange={(event) => onAttachEvidence(activeQuestionEntry.index, event.target.files)}
                      disabled={attachingQuestionEvidence[activeQuestionEntry.index]}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={onSaveAnswers}
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
        ) : (
          <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
            No questions generated yet. Generate from Capture intake and Working Material to start resolving planning prompts and understanding gaps.
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
