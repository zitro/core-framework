/**
 * AI feedback client — user notes attached to AI-generated artifacts.
 *
 * Persists via the configured storage provider (filesystem locally, Cosmos
 * in Azure). Discovery-scoped; further scoped by `surface` (problem,
 * usecase, narrative, grounded, questions) and optionally `item_key`.
 */

import { request } from "@/lib/http";

export type AiFeedbackSurface =
  | "problem"
  | "usecase"
  | "narrative"
  | "grounded"
  | "questions"
  | "expert_review"
  | "blueprint";

export interface AiFeedbackRecord {
  id: string;
  project_id: string;
  discovery_id: string;
  surface: AiFeedbackSurface;
  item_key: string | null;
  feedback: string;
  author: string;
  created_at: string;
  updated_at: string;
}

interface CreatePayload {
  discovery_id: string;
  surface: AiFeedbackSurface;
  item_key?: string | null;
  feedback: string;
}

export const aiFeedbackApi = {
  list: (
    discoveryId: string,
    surface: AiFeedbackSurface,
    itemKey?: string | null,
  ) => {
    const params = new URLSearchParams({
      discovery_id: discoveryId,
      surface,
    });
    if (itemKey) params.set("item_key", itemKey);
    return request<AiFeedbackRecord[]>(`/api/ai-feedback?${params.toString()}`);
  },

  create: (payload: CreatePayload) =>
    request<AiFeedbackRecord>("/api/ai-feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  remove: (feedbackId: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/ai-feedback/${encodeURIComponent(feedbackId)}`,
      { method: "DELETE" },
    ),
};
