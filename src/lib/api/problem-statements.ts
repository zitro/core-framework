import type { ProblemStatementVersion } from "@/types/core";
import { request } from "@/lib/http";

export const problemStatements = {
  list: (discoveryId: string) =>
    request<ProblemStatementVersion[]>(`/api/problem-statements/${discoveryId}`),
  generate: (data: { discovery_id: string; user_instructions?: string }) =>
    request<ProblemStatementVersion>("/api/problem-statements/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
