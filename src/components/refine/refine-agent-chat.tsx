"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, MessageSquareText, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { RefineAgentDefinition, RefineChatMessage } from "@/types/core";

interface RefineAgentChatProps {
  discoveryId: string;
  agents: RefineAgentDefinition[];
  onReviewVersionCreated?: () => void;
}

type ChatTarget = {
  threadType: "group" | "agent";
  agentId: string;
};

export function RefineAgentChat({ discoveryId, agents, onReviewVersionCreated }: RefineAgentChatProps) {
  const [target, setTarget] = useState<ChatTarget>({ threadType: "group", agentId: "" });
  const [messages, setMessages] = useState<RefineChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === target.agentId),
    [agents, target.agentId],
  );

  const loadMessages = useCallback(async () => {
    if (!discoveryId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await api.refine.chatMessages(discoveryId, {
        thread_type: target.threadType,
        agent_id: target.agentId || undefined,
      });
      setMessages(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }, [discoveryId, target.agentId, target.threadType]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const sendMessage = async () => {
    const message = draft.trim();
    if (!message) return;
    setSending(true);
    setError(null);
    try {
      const newMessages = await api.refine.sendChat({
        discovery_id: discoveryId,
        thread_type: target.threadType,
        agent_id: target.agentId || undefined,
        message,
      });
      setMessages((prev) => [...prev, ...newMessages]);
      if (newMessages.some((message) => message.review_version > 0)) {
        onReviewVersionCreated?.();
      }
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const title = target.threadType === "group" ? "Group Advisory Chat" : `${activeAgent?.title ?? "Agent"} Chat`;
  const description = target.threadType === "group"
    ? "Add your opinion to the board. Agents make one bounded response pass, persist what changes, then wait for you."
    : "Ask one advisor. The answer stays inside that role's lens.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-emerald-500" />
          Agent Chat
        </CardTitle>
        <CardDescription>
          Speak to the full board or a single expert after the automatic review has been generated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={target.threadType === "group" ? "default" : "outline"}
            onClick={() => setTarget({ threadType: "group", agentId: "" })}
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Group Chat
          </Button>
          {agents.map((agent) => (
            <Button
              key={agent.id}
              type="button"
              size="sm"
              variant={target.threadType === "agent" && target.agentId === agent.id ? "default" : "outline"}
              onClick={() => setTarget({ threadType: "agent", agentId: agent.id })}
            >
              <Bot className="mr-1.5 h-3.5 w-3.5" />
              {agent.title}
            </Button>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/20">
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
              {target.threadType === "agent" && activeAgent && (
                <Badge variant="secondary" className="text-[10px]">
                  {activeAgent.expected_outputs[0] ?? "role-specific"}
                </Badge>
              )}
            </div>
          </div>

          <ScrollArea className="h-[420px]">
            <div className="space-y-3 p-4">
              {loading && <p className="text-sm text-muted-foreground">Loading chat...</p>}
              {!loading && messages.length === 0 && (
                <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  No messages yet. Start with a question, correction, disagreement, or decision you want the advisors to react to.
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id || `${message.speaker}-${message.created_at}-${message.content}`}
                  className={`rounded-lg border p-3 ${message.role === "user" ? "bg-background" : "bg-emerald-500/5 border-emerald-500/20"}`}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant={message.role === "user" ? "outline" : "secondary"} className="text-[10px]">
                      {message.speaker}
                    </Badge>
                    {message.contribution_type && (
                      <span className="text-[11px] text-muted-foreground">{message.contribution_type.replace("_", " ")}</span>
                    )}
                    {message.review_version > 0 && (
                      <Badge variant="outline" className="text-[10px]">v{message.review_version}</Badge>
                    )}
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{message.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={target.threadType === "group" ? "Tell the board what you think, ask for alignment, or challenge an assumption..." : `Ask ${activeAgent?.title ?? "this agent"} from their role-specific perspective...`}
            rows={3}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void sendMessage()} disabled={sending || !draft.trim()}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {sending ? "Sending..." : "Send"}
            </Button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
