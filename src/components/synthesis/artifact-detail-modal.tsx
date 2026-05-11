"use client";

/**
 * ArtifactDetailModal — full-bleed dialog combining detail / thread / chat.
 *
 * Tabs:
 *   - Detail: structured body (delegates to <ArtifactDetailView>).
 *   - Thread: notes + AI turns via <ThreadPanel>.
 *   - Chat:   grounded chat via <ArtifactChatPanel> (turns join the thread).
 *
 * The thread loads once when the modal opens; subsequent panels mutate
 * the same comments array so add / delete / chat stay in sync.
 *
 * "Push to engagement-repo" calls POST /artifacts/{id}/push — the writer
 * is a no-op until ``project.metadata.engagement-repo.write_enabled`` is
 * flipped on via the VertexWriteBackToggle.
 */

import { useEffect, useState } from "react";
import { FileText, MessageSquare, RefreshCw, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { synthesisApi } from "@/lib/api-synthesis";
import type {
  ArtifactCommentRecord,
  SynthesisArtifact,
} from "@/types/synthesis";

import { ArtifactChatPanel } from "@/components/synthesis/artifact-chat-panel";
import { ArtifactDetailView } from "@/components/synthesis/artifact-detail-view";
import { ExportButtons } from "@/components/synthesis/export-buttons";
import { ThreadPanel } from "@/components/synthesis/thread-panel";

interface Props {
  projectId: string;
  artifact: SynthesisArtifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentCountChange?: (artifactId: string, count: number) => void;
  onRegenerated?: () => void;
}

export function ArtifactDetailModal({
  projectId,
  artifact,
  open,
  onOpenChange,
  onCommentCountChange,
  onRegenerated,
}: Props) {
  const [comments, setComments] = useState<ArtifactCommentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [tab, setTab] = useState<"detail" | "thread" | "chat">("detail");

  useEffect(() => {
    if (!open || !artifact) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await synthesisApi.threads.get(projectId, artifact.id);
        if (!cancelled) setComments(res.comments);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "Couldn't load thread",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, artifact]);

  const updateComments = (next: ArtifactCommentRecord[]) => {
    setComments(next);
    if (artifact) onCommentCountChange?.(artifact.id, next.length);
  };

  const pushToVertex = async () => {
    if (!artifact) return;
    setPushing(true);
    try {
      const res = await synthesisApi.threads.push(projectId, artifact.id);
      if (!res.enabled) {
        toast.info(
          "Engagement-repo write-back is disabled — flip it on in the Sources tab.",
        );
      } else if (res.errors.length > 0) {
        toast.error(`Push failed: ${res.errors[0]}`);
      } else {
        toast.success(
          res.written.length > 0
            ? `Pushed ${res.written.length} file(s) to engagement-repo.`
            : "Push completed.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Push failed");
    } finally {
      setPushing(false);
    }
  };

  const regenerateWithThread = async () => {
    if (!artifact) return;
    const notes = comments
      .filter((c) => c.role === "user" && c.body.trim())
      .slice(-8)
      .map((c) => `- ${c.body.trim()}`)
      .join("\n");
    if (!notes) {
      toast.info("Add a note or chat turn first so the AI has context.");
      return;
    }
    const instructions =
      `Incorporate the following user notes and corrections into the next version:\n${notes}`;
    setRegenerating(true);
    try {
      await synthesisApi.regenerate(projectId, artifact.type_id, instructions);
      toast.success("Regenerated with your notes applied.");
      onRegenerated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  };

  if (!artifact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col gap-3 sm:max-w-3xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-heading text-base">
            {artifact.title}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{artifact.type_id}</Badge>
            <span>v{artifact.version}</span>
            <span>· {artifact.status}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <ExportButtons projectId={projectId} />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={pushing}
                onClick={() => void pushToVertex()}
                title="Push this artifact to the engagement-repo (requires write-back enabled)"
              >
                {pushing ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <UploadCloud className="mr-1.5 h-3 w-3" />
                )}
                Push to engagement-repo
              </Button>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList>
            <TabsTrigger value="detail">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Detail
            </TabsTrigger>
            <TabsTrigger value="thread">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Thread
              {comments.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-4 px-1 text-[10px]"
                >
                  {comments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chat">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Chat
            </TabsTrigger>
          </TabsList>
          <TabsContent value="detail" className="min-h-0 flex-1">
            <p className="pb-2 text-[11px] text-muted-foreground">
              The artifact contents — generated from your sources.
            </p>
            <ArtifactDetailView artifact={artifact} loading={loading} />
          </TabsContent>
          <TabsContent value="thread" className="min-h-0 flex-1">
            <p className="pb-2 text-[11px] text-muted-foreground">
              Notes and comments from you and your team. Humans only.
            </p>
            <ThreadPanel
              projectId={projectId}
              artifactId={artifact.id}
              comments={comments}
              onChange={updateComments}
              loading={loading}
            />
          </TabsContent>
          <TabsContent value="chat" className="min-h-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Assistant grounded in this artifact, your engagement context,
                and the thread below.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={regenerateWithThread}
                disabled={regenerating}
                title="Apply thread notes as instructions and regenerate this artifact"
              >
                {regenerating ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                )}
                Apply thread &amp; regenerate
              </Button>
            </div>
            <ArtifactChatPanel
              projectId={projectId}
              artifactId={artifact.id}
              onTurn={(u, a) => updateComments([...comments, u, a])}
            />
            <ThreadPanel
              projectId={projectId}
              artifactId={artifact.id}
              comments={comments}
              onChange={updateComments}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
