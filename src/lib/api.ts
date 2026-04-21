import type {
  Discovery,
  Evidence,
  ProblemStatementVersion,
  QuestionSet,
  TranscriptAnalysis,
  CorePhase,
  SolutionMatchResult,
  UseCaseVersion,
  SolutionBlueprint,
  EngagementScanResult,
  EngagementExportResult,
  EngagementContentResult,
  IngestClassification,
  IngestWriteResult,
} from "@/types/core";
import { toast } from "sonner";
import { API_URL, authHeader, request } from "@/lib/http";

export const api = {
  // Health
  health: () => request<{ status: string; providers: Record<string, string> }>("/api/health"),

  // Identity
  me: () =>
    request<{
      auth_provider: string;
      authenticated: boolean;
      sub: string;
      name: string;
      email: string;
      tenant_id: string;
    }>("/api/me"),

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
    list: (discoveryId: string, phase?: CorePhase) =>
      request<QuestionSet[]>(
        `/api/questions/${discoveryId}${phase ? `?phase=${phase}` : ""}`
      ),
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
    list: (discoveryId: string) =>
      request<TranscriptAnalysis[]>(`/api/transcripts/${discoveryId}`),
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

  // Problem Statements
  problemStatements: {
    list: (discoveryId: string) =>
      request<ProblemStatementVersion[]>(`/api/problem-statements/${discoveryId}`),
    generate: (data: { discovery_id: string; user_instructions?: string }) =>
      request<ProblemStatementVersion>("/api/problem-statements/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Export
  export: {
    download: (discoveryId: string, format: "json" | "csv" = "json") => {
      const url = `${API_URL}/api/export/${discoveryId}?format=${format}`;
      window.open(url, "_blank");
    },
  },

  // Docs
  docs: {
    scan: (path: string) =>
      request<{ path: string; files: { name: string; size: number; extension: string }[]; total_size: number }>(
        "/api/docs/scan",
        { method: "POST", body: JSON.stringify({ path }) }
      ),
  },

  // Use Cases (Advisor)
  useCases: {
    list: (discoveryId: string) =>
      request<UseCaseVersion[]>(`/api/advisor/use-cases/${discoveryId}`),
    generate: (data: { discovery_id: string; user_instructions?: string }) =>
      request<UseCaseVersion>("/api/advisor/use-cases/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Solution Blueprints
  blueprints: {
    list: (discoveryId: string) =>
      request<SolutionBlueprint[]>(`/api/blueprints/${discoveryId}`),
    generate: (data: { discovery_id: string; user_instructions?: string }) =>
      request<SolutionBlueprint>("/api/blueprints/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Engagement Repo Integration
  engagement: {
    scan: (path: string) =>
      request<EngagementScanResult>("/api/engagement/scan", {
        method: "POST",
        body: JSON.stringify({ path }),
      }),
    content: (path: string) =>
      request<EngagementContentResult>("/api/engagement/content", {
        method: "POST",
        body: JSON.stringify({ path }),
      }),
    export: (data: {
      discovery_id: string;
      repo_path: string;
      project_dir?: string;
    }) =>
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
  },

  // Web Search
  search: (query: string, limit = 5) =>
    request<{
      query: string;
      enabled: boolean;
      results: Array<{ title: string; url: string; snippet: string; source: string }>;
    }>("/api/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    }),

  // Discovery Narrative
  narrative: {
    generate: (data: {
      discovery_id: string;
      audience?: "executive" | "technical" | "customer" | "internal";
      style?: "narrative" | "brief" | "outline";
      focus?: string;
    }) =>
      request<{
        discovery_id: string;
        audience: string;
        style: string;
        headline: string;
        summary: string;
        sections: Array<{ title: string; body: string }>;
      }>("/api/narrative/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
