"use client";

/**
 * AddItemDialog (v2.2.8) — small modal that lets the user append a note
 * about a new item (persona, workstream, pain point, ...) and have AI fold
 * it into the targeted artifact (and optionally its category siblings).
 *
 * Wired by ArtifactCard. Posts to `synthesisApi.addNote`. The note is
 * persisted to the project corpus as a `user_note` source so future
 * regenerations of any artifact also pick it up.
 */

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { synthesisApi } from "@/lib/api-synthesis";

interface Props {
  projectId: string;
  typeId: string;
  typeLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => Promise<void> | void;
}

export function AddItemDialog({
  projectId,
  typeId,
  typeLabel,
  open,
  onOpenChange,
  onAdded,
}: Props) {
  const [text, setText] = useState("");
  const [propagate, setPropagate] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText("");
    setPropagate(true);
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      toast.error("Add at least a few words describing the new item.");
      return;
    }
    setBusy(true);
    try {
      const res = await synthesisApi.addNote(projectId, {
        text: trimmed,
        target_type_id: typeId,
        propagate,
      });
      const n = res.regenerated.length;
      toast.success(
        n === 0
          ? "Note saved to the project corpus."
          : `Note saved · regenerated ${n} artifact${n === 1 ? "" : "s"}.`,
      );
      if (res.failures.length > 0) {
        toast.warning(`${res.failures.length} regen failure(s) — see logs.`);
      }
      await onAdded();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" aria-hidden />
            Add to {typeLabel}
          </DialogTitle>
          <DialogDescription>
            Describe what you learned. AI will fold it into{" "}
            <span className="font-medium">{typeLabel}</span>
            {propagate ? " and related artifacts in the same category." : "."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            autoFocus
            rows={5}
            placeholder={`e.g. Add a Data Engineering Lead persona who owns ingestion and is frustrated by manual reconciliation...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={propagate}
              onChange={(e) => setPropagate(e.target.checked)}
              disabled={busy}
            />
            <span>
              Also update related artifacts in the same category. Slower but
              keeps the story consistent across cards.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || text.trim().length < 3}>
            {busy ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" /> Adding...
              </>
            ) : (
              "Add & regenerate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
