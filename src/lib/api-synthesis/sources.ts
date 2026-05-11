/**
 * Source corpus + write-back + export endpoints.
 *
 * Export (docx/pptx) is wired to the Phase 6J backend; sources-refresh,
 * writeback, and settings endpoints land in Phase 6K.
 */

import { request, requestBlob } from "@/lib/http";
import type {
  SynthesisRefreshResponse,
  SynthesisSources,
  SynthesisWriteBackResult,
} from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function downloadExport(projectId: string, fmt: "docx" | "pptx"): Promise<void> {
  const { blob, filename } = await requestBlob(
    `/api/synthesis/${pid(projectId)}/export/${fmt}`,
    { method: "POST" },
  );
  triggerBrowserDownload(blob, filename ?? `synthesis.${fmt}`);
}

export const sourcesApi = {
  sources: (projectId: string) =>
    request<SynthesisSources>(`/api/synthesis/${pid(projectId)}/sources`),

  refreshSources: (projectId: string) =>
    request<SynthesisRefreshResponse>(
      `/api/synthesis/${pid(projectId)}/sources/refresh`,
      { method: "POST" },
    ),

  writebackVertex: (projectId: string) =>
    request<SynthesisWriteBackResult>(
      `/api/synthesis/${pid(projectId)}/writeback/engagement-repo`,
      { method: "POST" },
    ),

  exportDocx: (projectId: string) => downloadExport(projectId, "docx"),
  exportPptx: (projectId: string) => downloadExport(projectId, "pptx"),

  updateVertexSettings: (
    projectId: string,
    settings: { write_enabled: boolean; write_subdir?: string | null },
  ) =>
    request<{
      "engagement-repo": { write_enabled: boolean; write_subdir?: string | null };
    }>(`/api/synthesis/${pid(projectId)}/settings/engagement-repo`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  updateOperationalSettings: (projectId: string, autoRebuild: boolean) =>
    request<{ auto_rebuild: boolean }>(
      `/api/synthesis/${pid(projectId)}/settings/operational`,
      {
        method: "PUT",
        body: JSON.stringify({ auto_rebuild: autoRebuild }),
      },
    ),
};
