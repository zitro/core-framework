"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  synthesisApi,
  type SynthesisChatTurn,
  type SynthesisCitation,
} from "@/lib/api-synthesis";

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const [sessionId, setSessionId] = useState("");
  const [turns, setTurns] = useState<SynthesisChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !projectId) return;
    setBusy(true);
    const userTurn: SynthesisChatTurn = {
      project_id: projectId,
      session_id: sessionId || "pending",
      role: "user",
      content: text,
      citations: [],
      follow_up_questions: [],
      model: "",
      created_at: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    try {
      const reply = await synthesisApi.chat(projectId, text, sessionId);
      if (!sessionId) setSessionId(reply.session_id);
      setTurns((prev) => [...prev, reply.turn]);
    } catch (err) {
      toast.error(`Chat failed: ${(err as Error).message}`);
      setTurns((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void onSend();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="size-4" />
          Chat over corpus
          {sessionId && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              {turns.length} turn{turns.length === 1 ? "" : "s"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="max-h-[420px] min-h-[120px] overflow-y-auto space-y-3 rounded-md border bg-muted/40 p-3 text-sm"
        >
          {turns.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ask a question about this project. Answers cite the corpus only.
            </p>
          ) : (
            turns.map((t, i) => (
              <ChatBubble key={`${t.created_at}-${i}`} turn={t} />
            ))
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything grounded in the project corpus… (Ctrl/Cmd+Enter to send)"
            rows={3}
            disabled={busy}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={onSend} disabled={busy || !input.trim()}>
              {busy ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatBubble({ turn }: { turn: SynthesisChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-background border"
        }`}
      >
        <p>{turn.content}</p>
        {!isUser && turn.citations?.length > 0 && (
          <div className="mt-2 space-y-1 border-t pt-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sources
            </p>
            {turn.citations.map((c: SynthesisCitation, i: number) => (
              <p key={i} className="text-[11px] text-muted-foreground">
                <code className="text-[10px]">{c.source_id}</code>
                {c.quote && ` — ${c.quote.slice(0, 160)}`}
              </p>
            ))}
          </div>
        )}
        {!isUser && turn.follow_up_questions?.length > 0 && (
          <div className="mt-2 space-y-1 border-t pt-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Follow-ups
            </p>
            {turn.follow_up_questions.map((q: string, i: number) => (
              <p key={i} className="text-[11px] italic text-muted-foreground">
                — {q}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
