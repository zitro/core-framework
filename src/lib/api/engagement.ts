import type {
  EngagementContentResult,
  EngagementExportResult,
  EngagementPublishResult,
  EngagementScanResult,
  EngagementSourceDeleteResult,
  IngestClassification,
  IngestWriteResult,
} from "@/types/core";
import { toast } from "sonner";
import { API_URL, authHeader, request } from "@/lib/http";

export const engagement = {
  scan: (path: string, options?: { refresh?: boolean }) =>
    request<EngagementScanResult>("/api/engagement/scan", {
      method: "POST",
      body: JSON.stringify({ path, refresh: options?.refresh ?? false }),
    }),
  content: (path: string) =>
    request<EngagementContentResult>("/api/engagement/content", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  export: (data: { discovery_id: string; repo_path: string; project_dir?: string }) =>
    request<EngagementExportResult>("/api/engagement/export", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  ingestClassify: (repoPath: string, content: string) =>
    request<IngestClassification>("/api/engagement/ingest/classify", {
      method: "POST",
      body: JSON.stringify({ repo_path: repoPath, content }),
    }),
  ingestWrite: (data: {
    content_dir: string;
    directory: string;
    filename: string;
    content: string;
    action: string;
    append_target: string;
  }) =>
    request<IngestWriteResult>("/api/engagement/ingest/write", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  ingestUpload: async (repoPath: string, file: File) => {
    const form = new FormData();
    form.append("repo_path", repoPath);
    form.append("file", file);
    const auth = await authHeader();
    const res = await fetch(`${API_URL}/api/engagement/ingest/upload`, {
      method: "POST",
      body: form,
      headers: auth,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      const message = error.detail || "Upload failed";
      toast.error(message);
      throw new Error(message);
    }
    return res.json() as Promise<
      IngestClassification & { source_filename: string; extracted_chars: number }
    >;
  },
  referencesRebuild: (path: string) =>
    request<{ path: string; count: number }>("/api/engagement/references/rebuild", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  publish: (data: {
    discovery_id: string;
    repo_paths?: string[];
    dry_run?: boolean;
    use_ai_placement?: boolean;
  }) =>
    request<EngagementPublishResult>("/api/engagement/publish", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteSource: (data: {
    discovery_id: string;
    source_type: "local_folder" | "repository";
    source_value: string;
    purge_cached_data?: boolean;
  }) =>
    request<EngagementSourceDeleteResult>("/api/engagement/source/delete", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
