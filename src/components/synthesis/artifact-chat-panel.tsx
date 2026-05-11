"use client";

/**
 * ArtifactChatPanel — grounded chat box scoped to a single artifact.
 *
 * Posts to ``/api/synthesis/{pid}/artifacts/{aid}/chat`` which builds
 * the prompt server-side (engagement context + artifact body + recent
 * thread history). The returned user/assistant pair is bubbled up via
 * ``onTurn`` so the host modal can splice the turns into the existing
 * thread state.
 *
 * Distinct from the corpus-wide <ChatPanel>; the difference is the
 * grounding surface, not the UX shell.
 */

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { synthesisApi } from "@/lib/api-synthesis";
import type { ArtifactCommentRecord } from "@/types/synthesis";

interface Props {
  projectId: string;
  artifactId: string;
  onTurn: (
    user: ArtifactCommentRecord,
    assistant: ArtifactCommentRecord,
  ) => void;
}

export function ArtifactChatPanel({ projectId, artifactId, onTurn }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await synthesisApi.threads.chat(projectId, artifactId, {
        body,
      });
      onTurn(res.user, res.assistant);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Grounded in this artifact + the engagement brief. The reply joins
        the thread.
      </p>
      <Textarea
        rows={3}
        placeholder="Ask the AI something about this artifact…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Chat message"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={ask} disabled={busy || !draft.trim()}>
          {busy ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-3.5 w-3.5" />
          )}
          Ask
        </Button>
      </div>
    </div>
  );
}
