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
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { ContextBriefVersion } from "@/types/core";

interface ContextBriefBuilderProps {
  discoveryId: string;
  context: string;
  onContextChange: Dispatch<SetStateAction<string>>;
  workingNotes: string;
  onWorkingNotesChange: (value: string) => void;
  onAddWorkingNotes: () => void;
  contextTextareaRef?: RefObject<HTMLTextAreaElement | null>;
}

const REVIEW_PROMPTS: { label: string; body: string }[] = [
  {
    label: "Missing stakeholder",
    body: "Add or correct stakeholder context:\n- Role/team:\n- Why they matter:\n- Decision or input needed:",
  },
  {
    label: "Wrong priority",
    body: "Correct the project priority:\n- What the brief overstates or misses:\n- What matters most now:\n- Why:",
  },
  {
    label: "Add constraint",
    body: "Add delivery constraint:\n- Constraint:\n- Owner/team affected:\n- Impact on timeline or scope:",
  },
  {
    label: "Add open question",
    body: "Add open question:\n- Question:\n- Why it matters:\n- Who can answer it:",
  },
];

const formatBriefAsContext = (version: ContextBriefVersion) => {
  const lines = [
    `AI project brief v${version.version}: ${version.title || "Project Brief"}`,
    version.summary,
    "",
    "Goals:",
    ...version.goals.map((item) => `- ${item}`),
    "",
    "Stakeholders:",
    ...version.stakeholders.map((item) => `- ${item}`),
    "",
    "Constraints and risks:",
    ...[...version.constraints, ...version.risks].map((item) => `- ${item}`),
    "",
    "Open questions:",
    ...version.open_questions.map((item) => `- ${item}`),
  ];
  return lines
    .filter((line, index) => line.trim() || lines[index - 1]?.trim())
    .join("\n")
    .trim();
};

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
  const [sourceOpen, setSourceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewNoteRef = useRef<HTMLTextAreaElement | null>(null);

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

  const applyReviewPrompt = (body: string) => {
    onWorkingNotesChange(body);
    window.requestAnimationFrame(() => reviewNoteRef.current?.focus());
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
        <ScrollArea className="max-h-48">
          <ul className="space-y-1">
            {[...versions].reverse().map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveVersion(v);
                    setHistoryOpen(false);
                  }}
                  className="group flex w-full cursor-pointer items-start gap-2 border-l-2 border-muted py-1 pl-2.5 text-left text-xs transition-colors hover:border-brand/60"
                >
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    v{v.version}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{v.title || v.summary}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      {activeVersion ? (
        <section className="space-y-4 border-l-2 border-brand/60 pl-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <Badge variant="secondary" className="text-[10px]">
              v{activeVersion.version}
            </Badge>
            <h3 className="font-heading text-base font-semibold">
              {activeVersion.title || "AI brief"}
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {new Date(activeVersion.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{activeVersion.summary}</p>
          {activeVersion.evidence_summary && (
            <p className="text-xs text-muted-foreground">{activeVersion.evidence_summary}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addBriefToContext}
            >
              Pin brief into working material
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BriefSection
              title="What we are trying to achieve"
              hint="Scope, outcomes, and success measures."
              items={activeVersion.goals}
            />
            <BriefSection
              title="Who needs to align"
              hint="Sponsors, owners, decision makers, working team."
              items={activeVersion.stakeholders}
            />
            <BriefSection
              title="What could slow delivery"
              hint="Constraints and risks to manage."
              items={[...activeVersion.constraints, ...activeVersion.risks]}
            />
            <BriefSection
              title="Decisions needed next"
              hint="Questions that should drive the next session."
              items={activeVersion.open_questions}
            />
          </div>
        </section>
      ) : (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          No project brief yet. Use the panel below to generate one.
        </p>
      )}

      <section className="space-y-3 border-t pt-5">
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Improve the brief
          </p>
          <p className="text-xs text-muted-foreground">
            One correction, missing fact, or decision. CORE folds it into the next version.
          </p>
        </div>

        <Textarea
          ref={reviewNoteRef}
          value={workingNotes}
          onChange={(event) => onWorkingNotesChange(event.target.value)}
          placeholder="e.g. The sponsor is Finance Ops, not IT. The first outcome is reducing manual reconciliation time before expanding to analytics automation."
          rows={5}
          className="text-sm"
        />

        <div className="flex flex-wrap gap-1.5">
          {REVIEW_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => applyReviewPrompt(prompt.body)}
              className="cursor-pointer rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
            >
              {prompt.label}
            </button>
          ))}
        </div>

        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
            Optional AI direction
          </summary>
          <Textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="e.g. tighten around the operating model and remove speculative technology recommendations."
            rows={2}
            className="mt-2 text-sm"
          />
        </details>

        <details className="group" open={sourceOpen} onToggle={(e) => setSourceOpen(e.currentTarget.open)}>
          <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
            {sourceOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Source material
          </summary>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {["Current process", "Tech landscape", "Approvals", "Environment", "Use case & value"].map(
                (label) => (
                  <Badge key={label} variant="outline" className="text-[10px]">
                    {label}
                  </Badge>
                ),
              )}
            </div>
            <Textarea
              ref={contextTextareaRef}
              value={context}
              onChange={(event) => onContextChange(event.target.value)}
              placeholder="Source notes and corrections that should shape questions and draft artifacts."
              rows={8}
              className="text-sm"
            />
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void generate(false)}
              disabled={generating}
            >
              {activeVersion ? "Refresh from sources" : "Generate brief"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddWorkingNotes}
              disabled={!workingNotes.trim()}
            >
              Save note only
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void updateBriefWithReviewNote()}
            disabled={generating || (!workingNotes.trim() && !instructions.trim())}
          >
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Updating…
              </>
            ) : (
              "Update brief"
            )}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>
    </div>
  );
}

function BriefSection({
  title,
  hint,
  items,
}: {
  title: string;
  hint: string;
  items: string[];
}) {
  return (
    <section className="space-y-1.5">
      <div className="space-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {items.length > 0 ? (
        <ol className="space-y-1">
          {items.map((item, index) => (
            <li
              key={`${title}:${index}`}
              className="flex gap-2 border-l-2 border-muted py-0.5 pl-2.5 text-xs leading-relaxed"
            >
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {index + 1}.
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">Nothing explicit yet.</p>
      )}
    </section>
  );
}
