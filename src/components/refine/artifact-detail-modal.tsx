"use client";

/**
 * ArtifactDetailModal — full-bleed dialog combining detail / thread / chat.
 *
 * Tabs:
 *   - Detail: structured body (delegates to DetailView, kept inline for
 *     scoping; mirrors the open-state of ArtifactCard).
 *   - Thread: comments + notes via <ThreadPanel>.
 *   - Chat:   grounded chat via <ChatPanel> (turns join the same thread).
 *
 * Loads the thread once on open; subsequent panels mutate the same
 * comments array so add / delete / chat all stay in sync.
 */

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type ArtifactCommentRecord } from "@/lib/api";
import type { SynthesisArtifact } from "@/lib/api-synthesis";
import { ThreadPanel } from "@/components/refine/thread-panel";
import { ChatPanel } from "@/components/refine/chat-panel";

interface Props {
  projectId: string;
  artifact: SynthesisArtifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentCountChange?: (artifactId: string, count: number) => void;
}

export function ArtifactDetailModal({
  projectId,
  artifact,
  open,
  onOpenChange,
  onCommentCountChange,
}: Props) {
  const [comments, setComments] = useState<ArtifactCommentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"detail" | "thread" | "chat">("detail");

  useEffect(() => {
    if (!open || !artifact) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.threads.get(projectId, artifact.id);
        if (!cancelled) setComments(res.comments);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Couldn't load thread");
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

  if (!artifact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col gap-3 sm:max-w-3xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{artifact.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{artifact.type_id}</Badge>
            <span>v{artifact.version}</span>
            <span>· {artifact.status}</span>
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="detail">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Detail
            </TabsTrigger>
            <TabsTrigger value="thread">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Thread
              {comments.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {comments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chat">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Chat
            </TabsTrigger>
          </TabsList>
          <TabsContent value="detail" className="min-h-0 flex-1">
            <DetailView artifact={artifact} loading={loading} />
          </TabsContent>
          <TabsContent value="thread" className="min-h-0 flex-1">
            <ThreadPanel
              projectId={projectId}
              artifactId={artifact.id}
              comments={comments}
              onChange={updateComments}
              loading={loading}
            />
          </TabsContent>
          <TabsContent value="chat" className="min-h-0 flex-1 space-y-3">
            <ChatPanel
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

function DetailView({ artifact, loading }: { artifact: SynthesisArtifact; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  const entries = Object.entries(artifact.body || {});
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4 pt-2">
        {artifact.summary && <p className="text-sm leading-relaxed">{artifact.summary}</p>}
        {entries.length > 0 && (
          <dl className="space-y-3 text-sm">
            {entries.map(([k, v]) => (
              <div key={k} className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd>{renderBody(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {artifact.citations.length > 0 && (
          <section className="space-y-2 border-t pt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Citations
            </h3>
            <ul className="space-y-1.5 text-xs">
              {artifact.citations.map((c, i) => (
                <li key={i}>
                  <code className="text-xs">{c.source_id}</code>
                  {c.quote && <span className="text-muted-foreground"> — “{c.quote}”</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}

function renderBody(value: unknown): React.ReactNode {
  if (value == null || value === "") return <em className="text-muted-foreground">empty</em>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <em className="text-muted-foreground">empty</em>;
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((v, i) => (
          <li key={i}>{renderBody(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}
