import type { CorePhase, Evidence } from "@/types/core";
import { toast } from "sonner";
import { API_URL, authHeader, getActiveProjectId, request } from "@/lib/http";
import { toBackendPhase } from "@/lib/api/_helpers";

export const evidence = {
  list: (discoveryId: string, phase?: CorePhase) =>
    request<Evidence[]>(
      `/api/evidence/${discoveryId}${phase ? `?phase=${toBackendPhase(phase)}` : ""}`
    ),
  create: (data: Partial<Evidence>) =>
    request<Evidence>("/api/evidence/", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        phase: toBackendPhase(data.phase),
      }),
    }),
  upload: async (data: {
    discovery_id: string;
    phase: CorePhase;
    evidence_type?: Evidence["evidence_type"];
    source?: string;
    note?: string;
    tags?: string[];
    file: File;
  }) => {
    const form = new FormData();
    form.append("discovery_id", data.discovery_id);
    form.append("phase", toBackendPhase(data.phase) ?? data.phase);
    form.append("evidence_type", data.evidence_type ?? "general");
    form.append("source", data.source ?? data.file.name);
    form.append("note", data.note ?? "");
    form.append("tags", (data.tags ?? []).join(","));
    form.append("file", data.file);
    const auth = await authHeader();
    const activeProjectId = getActiveProjectId();
    const res = await fetch(`${API_URL}/api/evidence/upload`, {
      method: "POST",
      credentials: "include",
      body: form,
      headers: {
        ...auth,
        ...(activeProjectId ? { "X-Project-Id": activeProjectId } : {}),
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = error.detail;
      const message = typeof detail === "string" ? detail : "Upload failed";
      toast.error(message);
      throw new Error(message);
    }
    return res.json() as Promise<Evidence>;
  },
  update: (id: string, data: Partial<Evidence>) =>
    request<Evidence>(`/api/evidence/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/evidence/${id}`, { method: "DELETE" }),
};
