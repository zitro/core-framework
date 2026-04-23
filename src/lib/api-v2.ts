/**
 * v2.0 API client.
 *
 * Wraps the /api/v2 surface (storyboard image generation + vertex repo
 * tree viewer). Kept in its own file so v1.x synthesis API stays tidy.
 */

import { API_URL, authHeader, request } from "@/lib/http";
import type { SynthesisArtifact } from "@/lib/api-synthesis";

export interface GenerateImagesResponse {
  artifact_id: string;
  provider: string;
  generated: number;
  skipped: number;
  artifact: SynthesisArtifact;
}

export interface VertexTreeNode {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: VertexTreeNode[];
}

export interface VertexTreeResponse {
  project_id: string;
  repo_path: string;
  root: VertexTreeNode | null;
  available: boolean;
  reason: string;
}

export interface VertexFileResponse {
  project_id: string;
  path: string;
  content: string;
  truncated: boolean;
  size: number;
}

export interface VertexExtractResponse {
  text: string;
  source: "paste" | "file" | "url";
  filename?: string | null;
  bytes: number;
}

export interface VertexClassifyResponse {
  dest_path: string;
  filename: string;
  rationale: string;
  confidence: number;
  sections_considered: string[];
}

export interface VertexWriteResponse {
  path: string;
  bytes: number;
  created: boolean;
}

export const v2Api = {
  generateImages: (projectId: string, artifactId: string) =>
    request<GenerateImagesResponse>(
      `/api/v2/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(artifactId)}/images`,
      { method: "POST" },
    ),

  vertexTree: (projectId: string) =>
    request<VertexTreeResponse>(
      `/api/v2/${encodeURIComponent(projectId)}/vertex/tree`,
    ),

  vertexFile: (projectId: string, path: string) =>
    request<VertexFileResponse>(
      `/api/v2/${encodeURIComponent(projectId)}/vertex/file?path=${encodeURIComponent(path)}`,
    ),

  vertexClassify: (projectId: string, body: { content: string; hint?: string; filename?: string }) =>
    request<VertexClassifyResponse>(
      `/api/v2/${encodeURIComponent(projectId)}/vertex/classify`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  vertexWrite: (
    projectId: string,
    body: {
      path: string;
      content: string;
      overwrite?: boolean;
      source?: "paste" | "file" | "url";
      classifier_confidence?: number;
    },
  ) =>
    request<VertexWriteResponse>(
      `/api/v2/${encodeURIComponent(projectId)}/vertex/write`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  vertexExtractUrl: (projectId: string, url: string) => {
    const form = new FormData();
    form.append("url", url);
    return v2ApiMultipart<VertexExtractResponse>(
      `/api/v2/${encodeURIComponent(projectId)}/vertex/extract`,
      form,
    );
  },

  vertexExtractFile: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return v2ApiMultipart<VertexExtractResponse>(
      `/api/v2/${encodeURIComponent(projectId)}/vertex/extract`,
      form,
    );
  },
};

async function v2ApiMultipart<T>(path: string, form: FormData): Promise<T> {
  const auth = await authHeader();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...auth },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json() as Promise<T>;
}
