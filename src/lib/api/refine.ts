import type {
  RefineAgentDefinition,
  RefineChatMessage,
  RefineReview,
} from "@/types/core";
import { request } from "@/lib/http";

export const refine = {
  agents: () => request<RefineAgentDefinition[]>("/api/refine/agents"),
  reviews: (discoveryId: string) =>
    request<RefineReview[]>(`/api/refine/reviews/${discoveryId}`),
  ensureFullReview: (discoveryId: string) =>
    request<RefineReview>(`/api/refine/reviews/auto/${discoveryId}`, {
      method: "POST",
    }),
  generateReview: (data: {
    discovery_id: string;
    agent_ids: string[];
    user_instructions?: string;
  }) =>
    request<RefineReview>("/api/refine/reviews/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  chatMessages: (
    discoveryId: string,
    data: { thread_type: "group" | "agent"; agent_id?: string }
  ) =>
    request<RefineChatMessage[]>(
      `/api/refine/chat/${discoveryId}?thread_type=${data.thread_type}${data.agent_id ? `&agent_id=${encodeURIComponent(data.agent_id)}` : ""}`,
    ),
  sendChat: (data: {
    discovery_id: string;
    thread_type: "group" | "agent";
    message: string;
    agent_id?: string;
  }) =>
    request<RefineChatMessage[]>("/api/refine/chat", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
