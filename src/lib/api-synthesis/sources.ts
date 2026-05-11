/**
 * Source corpus + write-back + export endpoints.
 *
 * NOTE: the sources/refresh, writeback, settings, and export endpoints
 * are scheduled for Phase 6J on main. The client methods are defined
 * here for shape parity with master; callers must render "coming soon"
 * disabled states (or skip the action entirely) until the backend ships.
 */

import { request } from "@/lib/http";
import type {
  SynthesisRefreshResponse,
  SynthesisSources,
  SynthesisWriteBackResult,
} from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

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

  exportDocxUrl: (projectId: string) =>
    `/api/synthesis/${pid(projectId)}/export/docx`,

  exportPptxUrl: (projectId: string) =>
    `/api/synthesis/${pid(projectId)}/export/pptx`,

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
