"use client";

/**
 * ThreadPanel — comments + free-form notes for one artifact.
 *
 * Loads thread on mount; lets the user add a note, delete a note, and
 * shows AI chat turns inline (rendered with role styling). The chat
 * input itself lives in <ChatPanel>; this panel renders both human and
 * AI turns since they share the same comment stream.
 */

import { useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type ArtifactCommentRecord } from "@/lib/api";

interface Props {
  projectId: string;
  artifactId: string;
  comments: ArtifactCommentRecord[];
  onChange: (next: ArtifactCommentRecord[]) => void;
  loading?: boolean;
}

export function ThreadPanel({
  projectId,
  artifactId,
  comments,
  onChange,
  loading,
}: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const addNote = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const c = await api.threads.postComment(projectId, artifactId, { body, role: "user" });
      onChange([...comments, c]);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post note");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.threads.deleteComment(projectId, artifactId, id);
      onChange(comments.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <ScrollArea className="flex-1 pr-3">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading thread…
          </div>
        ) : comments.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No notes yet. Add a note or start a chat — both live here.
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <CommentRow key={c.id} comment={c} onDelete={() => remove(c.id)} />
            ))}
          </ul>
        )}
      </ScrollArea>
      <div className="space-y-2 rounded-md border bg-muted/40 p-2">
        <Textarea
          rows={2}
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="New note"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={addNote} disabled={busy || !draft.trim()}>
            {busy ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-2 h-3.5 w-3.5" />
            )}
            Post note
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  onDelete,
}: {
  comment: ArtifactCommentRecord;
  onDelete: () => void;
}) {
  const isUser = comment.role === "user";
  const isAsst = comment.role === "assistant";
  const variant = isAsst ? "default" : isUser ? "secondary" : "outline";
  return (
    <li className="rounded-md border p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Badge variant={variant} className="capitalize">{comment.role}</Badge>
          <span>{comment.author || (isAsst ? "AI" : "you")}</span>
          <span aria-hidden>·</span>
          <time dateTime={comment.created_at}>{formatStamp(comment.created_at)}</time>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
          aria-label="Delete comment"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
    </li>
  );
}

function formatStamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
