import type { ExecuteOutputVersion } from "@/types/core";
import { request } from "@/lib/http";

export const executeOutputs = {
  list: (discoveryId: string) =>
    request<ExecuteOutputVersion[]>(`/api/execute-outputs/${discoveryId}`),
  ensure: (data: { discovery_id: string; output_ids?: string[]; force?: boolean }) =>
    request<ExecuteOutputVersion[]>("/api/execute-outputs/ensure", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  generate: (data: { discovery_id: string; output_id: string; force?: boolean }) =>
    request<ExecuteOutputVersion>("/api/execute-outputs/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
