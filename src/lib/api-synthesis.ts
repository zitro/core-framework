/**
 * Synthesis API client (v1.4.0).
 *
 * Thin wrappers around the /api/synthesis surface. All calls are
 * project-scoped and return strongly typed payloads the Synthesis page
 * can render directly.
 */

import { request } from "@/lib/http";

export type SynthesisCategoryId =
  | "why"
  | "value"
  | "what"
  | "scope"
  | "how"
  | "story";

export interface SynthesisCatalogType {
  id: string;
  label: string;
  description: string;
  critical: boolean;
}

export interface SynthesisCatalogCategory {
  id: SynthesisCategoryId;
  label: string;
  description: string;
  types: SynthesisCatalogType[];
}

export interface SynthesisCatalog {
  categories: SynthesisCatalogCategory[];
}

export interface SynthesisCitation {
  source_id: string;
  quote: string;
  note: string;
}

export interface SynthesisCritiqueIssue {
  severity: "info" | "warn" | "blocker";
  dimension: string;
  message: string;
  field: string;
}

export interface SynthesisCritique {
  id: string;
  project_id: string;
  artifact_id: string;
  artifact_type_id: string;
  score: number;
  issues: SynthesisCritiqueIssue[];
  model: string;
  created_at: string;
}

export interface SynthesisArtifact {
  id: string;
  project_id: string;
  type_id: string;
  category: SynthesisCategoryId;
  title: string;
  summary: string;
  body: Record<string, unknown>;
  citations: SynthesisCitation[];
  status: "draft" | "reviewed" | "approved";
  version: number;
  generated_by: string;
  model: string;
  created_at: string;
  updated_at: string;
  critique: SynthesisCritique | null;
}

export interface SynthesisQuestion {
  id: string;
  project_id: string;
  text: string;
  rationale: string;
  target_artifact_type_id: string;
  priority: number;
  answered: boolean;
  answer: string;
  created_at: string;
}

export interface SynthesisSourceDoc {
  id: string;
  kind: string;
  title: string;
  uri: string;
  snippet: string;
  last_modified: string;
}

export interface SynthesisSources {
  project_id: string;
  doc_count: number;
  built_at: string;
  docs: SynthesisSourceDoc[];
}

export interface SynthesisWriteBackResult {
  target: string;
  enabled: boolean;
  written: string[];
  skipped: string[];
  errors: string[];
}

export interface SynthesisRunResult {
  project_id: string;
  corpus_doc_count: number;
  artifact_count: number;
  question_count: number;
  failures: { type_id: string; error: string }[];
  writeback?: { vertex?: SynthesisWriteBackResult };
}

export const synthesisApi = {
  catalog: () => request<SynthesisCatalog>("/api/synthesis/catalog"),

  artifacts: (projectId: string) =>
    request<{ artifacts: SynthesisArtifact[] }>(
      `/api/synthesis/${encodeURIComponent(projectId)}/artifacts`,
    ),

  sources: (projectId: string) =>
    request<SynthesisSources>(
      `/api/synthesis/${encodeURIComponent(projectId)}/sources`,
    ),

  questions: (projectId: string) =>
    request<{ questions: SynthesisQuestion[] }>(
      `/api/synthesis/${encodeURIComponent(projectId)}/questions`,
    ),

  synthesize: (projectId: string) =>
    request<SynthesisRunResult>(
      `/api/synthesis/${encodeURIComponent(projectId)}/synthesize`,
      { method: "POST" },
    ),

  regenerate: (projectId: string, typeId: string, instructions = "") =>
    request<{ artifact: SynthesisArtifact; critique: SynthesisCritique | null }>(
      `/api/synthesis/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(typeId)}/regenerate`,
      {
        method: "POST",
        body: JSON.stringify({ type_id: typeId, instructions }),
      },
    ),

  refreshQuestions: (projectId: string) =>
    request<{ questions: SynthesisQuestion[] }>(
      `/api/synthesis/${encodeURIComponent(projectId)}/questions/refresh`,
      { method: "POST" },
    ),

  writebackVertex: (projectId: string) =>
    request<SynthesisWriteBackResult>(
      `/api/synthesis/${encodeURIComponent(projectId)}/writeback/vertex`,
      { method: "POST" },
    ),

  exportDocxUrl: (projectId: string) =>
    `/api/synthesis/${encodeURIComponent(projectId)}/export/docx`,

  exportPptxUrl: (projectId: string) =>
    `/api/synthesis/${encodeURIComponent(projectId)}/export/pptx`,

  chat: (projectId: string, message: string, sessionId = "") =>
    request<SynthesisChatReply>(
      `/api/synthesis/${encodeURIComponent(projectId)}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ message, session_id: sessionId }),
      },
    ),

  chatHistory: (projectId: string, sessionId: string) =>
    request<{ session_id: string; turns: SynthesisChatTurn[] }>(
      `/api/synthesis/${encodeURIComponent(projectId)}/chat/${encodeURIComponent(sessionId)}`,
    ),

  chatSessions: (projectId: string) =>
    request<{ sessions: SynthesisChatSession[] }>(
      `/api/synthesis/${encodeURIComponent(projectId)}/chat`,
    ),

  updateVertexSettings: (
    projectId: string,
    settings: { write_enabled: boolean; write_subdir?: string | null },
  ) =>
    request<{ vertex: { write_enabled: boolean; write_subdir?: string | null } }>(
      `/api/synthesis/${encodeURIComponent(projectId)}/settings/vertex`,
      {
        method: "PUT",
        body: JSON.stringify(settings),
      },
    ),
};

export interface SynthesisChatTurn {
  id?: string;
  project_id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  citations: SynthesisCitation[];
  follow_up_questions: string[];
  model: string;
  created_at: string;
}

export interface SynthesisChatReply {
  session_id: string;
  turn: SynthesisChatTurn;
  answer: string;
  citations: SynthesisCitation[];
  follow_up_questions: string[];
}

export interface SynthesisChatSession {
  session_id: string;
  started_at: string;
  last_at: string;
  turns: number;
}
