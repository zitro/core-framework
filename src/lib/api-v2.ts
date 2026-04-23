/**
 * v2.0 API client.
 *
 * Wraps the /api/v2 surface (storyboard image generation + vertex repo
 * tree viewer). Kept in its own file so v1.x synthesis API stays tidy.
 */

import { request } from "@/lib/http";
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
};
