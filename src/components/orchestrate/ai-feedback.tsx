"use client";

/**
 * AiFeedback — reusable "tell the AI what to do differently" widget.
 *
 * Drop-in for any Orchestrate surface where AI output benefits from
 * persistent user feedback. The widget loads existing feedback on mount,
 * lets users add new entries, and supports hover-delete. Feedback is
 * scoped by ``discoveryId + surface`` and optionally ``itemKey``.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aiFeedbackApi, type AiFeedbackRecord, type AiFeedbackSurface } from "@/lib/api-ai-feedback";

interface Props {
  discoveryId: string;
  surface: AiFeedbackSurface;
  /** Per-item scoping. Omit for surface-level feedback. */
  itemKey?: string | null;
  /** Optional override for the textarea placeholder. */
  placeholder?: string;
}

export function AiFeedback({ discoveryId, surface, itemKey = null, placeholder }: Props) {
  const [items, setItems] = useState<AiFeedbackRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!discoveryId) return;
    setLoading(true);
    try {
      const next = await aiFeedbackApi.list(discoveryId, surface, itemKey);
      setItems(next);
    } catch {
      // toast already fired by the http layer
    } finally {
      setLoading(false);
    }
  }, [discoveryId, surface, itemKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !discoveryId) return;
    setBusy(true);
    try {
      const created = await aiFeedbackApi.create({
        discovery_id: discoveryId,
        surface,
        item_key: itemKey,
        feedback: text,
      });
      setItems((prev) => [...prev, created]);
      setDraft("");
      toast.success("Feedback saved.");
    } catch {
      // surfaced by http
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await aiFeedbackApi.remove(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // surfaced by http
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <MessageSquarePlus className="h-3 w-3" />
        <span>Feedback to AI</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="group flex items-start justify-between gap-2 border-l-2 border-brand/40 pl-2.5 py-0.5"
            >
              <p className="flex-1 text-xs leading-relaxed text-foreground/85">
                {entry.feedback}
              </p>
              <button
                type="button"
                aria-label="Remove feedback"
                onClick={() => void remove(entry.id)}
                className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (draft.trim() && !busy) void submit();
            }
          }}
          placeholder={
            placeholder ??
            "Tell AI how to do better — e.g. \"too generic, focus on claims-cycle time\""
          }
          rows={2}
          className="text-xs"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            <kbd className="rounded border bg-muted/60 px-1 font-mono text-[9px]">⌘</kbd>
            <span className="mx-0.5">+</span>
            <kbd className="rounded border bg-muted/60 px-1 font-mono text-[9px]">Enter</kbd> to save
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={busy || draft.trim().length === 0}
            className="h-7 text-xs"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
