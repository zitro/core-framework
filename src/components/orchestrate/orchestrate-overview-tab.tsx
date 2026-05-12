"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  ListChecks,
} from "lucide-react";
import { ContextBriefBuilder } from "@/components/orchestrate/context-brief-builder";
import { TOPIC_INSERTS } from "@/components/orchestrate/orchestrate-constants";

type Props = {
  discoveryId: string;
  context: string;
  onContextChange: Dispatch<SetStateAction<string>>;
  workingNotes: string;
  onWorkingNotesChange: (value: string) => void;
  onAddWorkingNotes: () => void;
  contextTextareaRef: RefObject<HTMLTextAreaElement | null>;
  error: string | null;
  shortcutMessage: string;
  showFocusedSections: boolean;
  onApplyIntroCallTemplate: () => void;
  onLoadStarterQuestions: () => void;
  onAppendTopicBlock: (label: string, body: string) => void;
};

export function OrchestrateOverviewTab({
  discoveryId,
  context,
  onContextChange,
  workingNotes,
  onWorkingNotesChange,
  onAddWorkingNotes,
  contextTextareaRef,
  error,
  shortcutMessage,
  showFocusedSections,
  onApplyIntroCallTemplate,
  onLoadStarterQuestions,
  onAppendTopicBlock,
}: Props) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.75fr)]">
      <div className="space-y-4">
        <ContextBriefBuilder
          discoveryId={discoveryId}
          context={context}
          onContextChange={onContextChange}
          workingNotes={workingNotes}
          onWorkingNotesChange={onWorkingNotesChange}
          onAddWorkingNotes={onAddWorkingNotes}
          contextTextareaRef={contextTextareaRef}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <aside className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <ClipboardList className="h-3 w-3" />
            <span>Session Starters</span>
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onApplyIntroCallTemplate}
              className="group flex w-full cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-muted/40"
            >
              <FilePlus2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-brand" />
              <span className="min-w-0">
                <span className="block text-xs font-medium">Intro Call Template</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  Populate Working Material with a complete discovery-call outline.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={onLoadStarterQuestions}
              className="group flex w-full cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-muted/40"
            >
              <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-brand" />
              <span className="min-w-0">
                <span className="block text-xs font-medium">Starter Questions</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  Open a ready-made question queue for an intro discovery call.
                </span>
              </span>
            </button>
          </div>
        </div>

        {shortcutMessage && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span>{shortcutMessage}</span>
          </div>
        )}

        {showFocusedSections && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Add a focused section
            </p>
            <div className="space-y-1">
              {TOPIC_INSERTS.map((topic) => {
                const TopicIcon = topic.icon;
                return (
                  <button
                    key={topic.label}
                    type="button"
                    className="group flex w-full cursor-pointer items-start gap-2 border-l-2 border-muted py-0.5 pl-2.5 text-left transition-colors hover:border-brand/60"
                    onClick={() => onAppendTopicBlock(topic.label, topic.body)}
                  >
                    <TopicIcon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground group-hover:text-brand" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium leading-snug">{topic.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        {topic.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
