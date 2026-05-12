import type { TranscriptAnalysis } from "@/types/core";
import { request } from "@/lib/http";

export const transcripts = {
  list: (discoveryId: string) =>
    request<TranscriptAnalysis[]>(`/api/transcripts/${discoveryId}`),
  analyze: (data: { discovery_id: string; transcript_text: string }) =>
    request<TranscriptAnalysis>("/api/transcripts/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
