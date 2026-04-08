import type {
  Discovery,
  Evidence,
  QuestionSet,
  TranscriptAnalysis,
  CorePhase,
  SolutionMatchResult,
} from "@/types/core";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

export const api = {
  // Health
  health: () => request<{ status: string; providers: Record<string, string> }>("/api/health"),

  // Discoveries
  discoveries: {
    list: () => request<Discovery[]>("/api/discovery/"),
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
  },

  // Questions
  questions: {
    generate: (data: {
      discovery_id: string;
      phase: CorePhase;
      context?: string;
      num_questions?: number;
    }) =>
      request<QuestionSet>("/api/questions/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    solutionMatch: (data: {
      discovery_id: string;
      problem: string;
      capabilities: string[];
    }) =>
      request<SolutionMatchResult>("/api/questions/solution-match", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Transcripts
  transcripts: {
    analyze: (data: { discovery_id: string; transcript_text: string }) =>
      request<TranscriptAnalysis>("/api/transcripts/analyze", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Evidence
  evidence: {
    list: (discoveryId: string, phase?: CorePhase) =>
      request<Evidence[]>(
        `/api/evidence/${discoveryId}${phase ? `?phase=${phase}` : ""}`
      ),
    create: (data: Partial<Evidence>) =>
      request<Evidence>("/api/evidence/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Evidence>) =>
      request<Evidence>(`/api/evidence/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/api/evidence/${id}`, { method: "DELETE" }),
  },
};
