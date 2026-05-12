import type { Discovery } from "@/types/core";
import { request } from "@/lib/http";

export const discoveries = {
  list: (projectId?: string) =>
    request<Discovery[]>(`/api/discovery/${projectId ? `?project_id=${projectId}` : ""}`),
  get: (id: string) => request<Discovery>(`/api/discovery/${id}`),
  create: (data: Partial<Discovery>) =>
    request<Discovery>("/api/discovery/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Discovery>) =>
    request<Discovery>(`/api/discovery/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/discovery/${id}`, { method: "DELETE" }),
};
