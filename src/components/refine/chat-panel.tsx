"use client";

/**
 * ChatPanel — grounded chat box for one artifact.
 *
 * Posts to /api/synthesis/{pid}/artifacts/{aid}/chat which builds the
 * grounded prompt server-side (engagement context + artifact body +
 * recent thread history) and returns a paired user/assistant comment.
 * The parent thread is refreshed via onTurn so the conversation
 * surfaces in <ThreadPanel> too.
 */

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, type ArtifactCommentRecord } from "@/lib/api";

interface Props {
  projectId: string;
  artifactId: string;
  onTurn: (user: ArtifactCommentRecord, assistant: ArtifactCommentRecord) => void;
}

export function ChatPanel({ projectId, artifactId, onTurn }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await api.threads.chat(projectId, artifactId, { body });
      onTurn(res.user, res.assistant);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        Grounded in this artifact + the engagement brief. The reply joins the thread.
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
