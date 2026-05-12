import type { ContextBriefVersion } from "@/types/core";
import { request } from "@/lib/http";

export const contextBriefs = {
  list: (discoveryId: string) =>
    request<ContextBriefVersion[]>(`/api/context-briefs/${discoveryId}`),
  generate: (data: {
    discovery_id: string;
    user_instructions?: string;
    working_context?: string;
    force?: boolean;
  }) =>
    request<ContextBriefVersion>("/api/context-briefs/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
