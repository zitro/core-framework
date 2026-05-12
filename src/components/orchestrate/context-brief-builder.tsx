"use client";

/**
 * ContextBriefBuilder — the AI-maintained "what we know about this
 * discovery" brief that feeds every other Orchestrate tab.
 *
 * Purpose: keep a single, evolving project brief synchronized with
 * working notes + source material. User reviews, corrects, regenerates.
 * The latest version is what Questions / Drafts / Narrative all ground
 * on, so this surface is the spine of Orchestrate.
 */

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { History } from "lucide-react";

import { api } from "@/lib/api";
import type { ContextBriefVersion } from "@/types/core";

import { BriefActiveView } from "./brief-active-view";
import { BriefHistoryList } from "./brief-history-list";
import { BriefReviewPanel } from "./brief-review-panel";
import { formatBriefAsContext } from "./context-brief-helpers";

interface ContextBriefBuilderProps {
  discoveryId: string;
  context: string;
  onContextChange: Dispatch<SetStateAction<string>>;
  workingNotes: string;
  onWorkingNotesChange: (value: string) => void;
  onAddWorkingNotes: () => void;
  contextTextareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export function ContextBriefBuilder({
  discoveryId,
  context,
  onContextChange,
  workingNotes,
  onWorkingNotesChange,
  onAddWorkingNotes,
  contextTextareaRef,
}: ContextBriefBuilderProps) {
  const [versions, setVersions] = useState<ContextBriefVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<ContextBriefVersion | null>(null);
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      force: boolean,
      override?: { workingContext?: string; userInstructions?: string },
    ) => {
      if (!discoveryId) return;
      setGenerating(true);
      setError(null);
      const workingContext =
        override?.workingContext ??
        [context.trim(), workingNotes.trim()].filter(Boolean).join("\n\n");
      const userInstructions = override?.userInstructions ?? instructions;
      try {
        const result = await api.contextBriefs.generate({
          discovery_id: discoveryId,
          user_instructions: userInstructions || undefined,
          working_context: workingContext || undefined,
          force,
        });
        setVersions((prev) => (prev.some((item) => item.id === result.id) ? prev : [...prev, result]));
        setActiveVersion(result);
        setInstructions("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate project brief");
      } finally {
        setGenerating(false);
      }
    },
    [context, discoveryId, instructions, workingNotes],
  );

  useEffect(() => {
    if (!discoveryId) return;
    api.contextBriefs
      .list(discoveryId)
      .then((items) => {
        setVersions(items);
        setActiveVersion(items.at(-1) ?? null);
      })
      .catch(() => {
        /* non-critical */
      });
  }, [discoveryId]);

  const addBriefToContext = () => {
    if (!activeVersion) return;
    const block = formatBriefAsContext(activeVersion);
    onContextChange((previous) =>
      previous.includes(block) ? previous : [previous.trim(), block].filter(Boolean).join("\n\n"),
    );
    window.requestAnimationFrame(() => contextTextareaRef?.current?.focus());
  };

  const updateBriefWithReviewNote = async () => {
    const note = workingNotes.trim();
    const nextContext = [context.trim(), note].filter(Boolean).join("\n\n");
    if (note) {
      onContextChange(nextContext);
      onWorkingNotesChange("");
    }
    await generate(true, {
      workingContext: nextContext,
      userInstructions: instructions.trim() || note,
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Project understanding</h2>
          <p className="text-xs text-muted-foreground">
            The single brief CORE keeps in sync with your notes + sources. Questions, drafts, and
            narrative all ground on the latest version.
          </p>
        </div>
        {versions.length > 0 && (
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <History className="h-3 w-3" />
            v{versions.length} · history
          </button>
        )}
      </header>

      {historyOpen && versions.length > 0 && (
        <BriefHistoryList
          versions={versions}
          onSelect={(v) => {
            setActiveVersion(v);
            setHistoryOpen(false);
          }}
        />
      )}

      {activeVersion ? (
        <BriefActiveView version={activeVersion} onPin={addBriefToContext} />
      ) : (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          No project brief yet. Use the panel below to generate one.
        </p>
      )}

      <BriefReviewPanel
        context={context}
        onContextChange={onContextChange}
        workingNotes={workingNotes}
        onWorkingNotesChange={onWorkingNotesChange}
        onAddWorkingNotes={onAddWorkingNotes}
        instructions={instructions}
        onInstructionsChange={setInstructions}
        hasActiveVersion={!!activeVersion}
        generating={generating}
        error={error}
        onRefresh={() => void generate(false)}
        onUpdate={() => void updateBriefWithReviewNote()}
        contextTextareaRef={contextTextareaRef}
      />
    </div>
  );
}
