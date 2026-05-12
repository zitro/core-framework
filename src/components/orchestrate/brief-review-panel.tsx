import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { REVIEW_PROMPTS } from "./context-brief-helpers";

interface BriefReviewPanelProps {
  context: string;
  onContextChange: Dispatch<SetStateAction<string>>;
  workingNotes: string;
  onWorkingNotesChange: (value: string) => void;
  onAddWorkingNotes: () => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  hasActiveVersion: boolean;
  generating: boolean;
  error: string | null;
  onRefresh: () => void;
  onUpdate: () => void;
  contextTextareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export function BriefReviewPanel({
  context,
  onContextChange,
  workingNotes,
  onWorkingNotesChange,
  onAddWorkingNotes,
  instructions,
  onInstructionsChange,
  hasActiveVersion,
  generating,
  error,
  onRefresh,
  onUpdate,
  contextTextareaRef,
}: BriefReviewPanelProps) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const reviewNoteRef = useRef<HTMLTextAreaElement | null>(null);

  const applyReviewPrompt = (body: string) => {
    onWorkingNotesChange(body);
    window.requestAnimationFrame(() => reviewNoteRef.current?.focus());
  };

  return (
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
          onChange={(event) => onInstructionsChange(event.target.value)}
          placeholder="e.g. tighten around the operating model and remove speculative technology recommendations."
          rows={2}
          className="mt-2 text-sm"
        />
      </details>

      <details
        className="group"
        open={sourceOpen}
        onToggle={(e) => setSourceOpen(e.currentTarget.open)}
      >
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
            onClick={onRefresh}
            disabled={generating}
          >
            {hasActiveVersion ? "Refresh from sources" : "Generate brief"}
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
          onClick={onUpdate}
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
  );
}
