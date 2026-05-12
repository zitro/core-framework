import type { UseCaseVersion } from "@/types/core";
import { request } from "@/lib/http";

export const useCases = {
  list: (discoveryId: string) =>
    request<UseCaseVersion[]>(`/api/advisor/use-cases/${discoveryId}`),
  generate: (data: { discovery_id: string; user_instructions?: string }) =>
    request<UseCaseVersion>("/api/advisor/use-cases/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
