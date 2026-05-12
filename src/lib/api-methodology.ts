/**
 * Methodology artifacts client — multi-instance templates saved per
 * discovery (Empathy Map, Persona, Journey Map, HMW Board, Champion Map,
 * Assumption Matrix). User-created or auto-generated from the corpus;
 * either way they fold into every CORE synthesis prompt.
 */

import { request } from "@/lib/http";

export type ArtifactSource = "user" | "auto";

export interface MethodologyArtifact {
  id: string;
  project_id: string;
  discovery_id: string;
  method_id: string;
  instance_id: string;
  title: string;
  fields: Record<string, string>;
  source: ArtifactSource;
  author: string;
  created_at: string;
  updated_at: string;
}

interface CreatePayload {
  discovery_id: string;
  method_id: string;
  title?: string;
  fields?: Record<string, string>;
  source?: ArtifactSource;
}

interface UpdatePayload {
  title?: string;
  fields?: Record<string, string>;
}

interface GeneratePayload {
  discovery_id: string;
  count?: number;
  replace?: boolean;
}

export const methodologyApi = {
  list: (discoveryId: string, methodId?: string) => {
    const params = new URLSearchParams({ discovery_id: discoveryId });
    if (methodId) params.set("method_id", methodId);
    return request<MethodologyArtifact[]>(`/api/methodology?${params.toString()}`);
  },

  create: (payload: CreatePayload) =>
    request<MethodologyArtifact>("/api/methodology", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (artifactId: string, payload: UpdatePayload) =>
    request<MethodologyArtifact>(`/api/methodology/${encodeURIComponent(artifactId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (artifactId: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/methodology/${encodeURIComponent(artifactId)}`,
      { method: "DELETE" },
    ),

  generate: (methodId: string, payload: GeneratePayload) =>
    request<MethodologyArtifact[]>(
      `/api/methodology/${encodeURIComponent(methodId)}/generate`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
};
