import type { SolutionBlueprint } from "@/types/core";
import { request } from "@/lib/http";

export const blueprints = {
  list: (discoveryId: string) =>
    request<SolutionBlueprint[]>(`/api/blueprints/${discoveryId}`),
  generate: (data: { discovery_id: string; user_instructions?: string }) =>
    request<SolutionBlueprint>("/api/blueprints/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
