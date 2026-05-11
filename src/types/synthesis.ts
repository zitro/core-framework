/**
 * Synthesis domain types (Phase 6I).
 *
 * Hand-written TS mirrors of ``backend/app/synthesis/models.py``. Kept
 * separate from the API client so components can depend on the types
 * without pulling the fetch layer.
 */

export type SynthesisCategoryId =
  | "why"
  | "value"
  | "what"
  | "scope"
  | "how"
  | "story"
  | "operational";

export type SynthesisStatus = "draft" | "reviewed" | "approved";
export type SynthesisSignalSeverity = "info" | "warn" | "blocker";
export type CompassHealth = "green" | "amber" | "red";
export type ArtifactCommentRole = "user" | "assistant" | "system";

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
  severity: SynthesisSignalSeverity;
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
  status: SynthesisStatus;
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
  writeback?: { "engagement-repo"?: SynthesisWriteBackResult };
}

export interface SynthesisConnector {
  kind: string;
  label: string;
  description: string;
  config_path: string;
  config_schema: Record<string, unknown>;
  builtin: boolean;
}

export interface SynthesisSignal {
  id: string;
  kind: string;
  severity: SynthesisSignalSeverity;
  title: string;
  message: string;
  artifact_id: string;
  artifact_type_id: string;
  action: string;
}

export interface SynthesisSignalsResponse {
  project_id: string;
  counts: Record<SynthesisSignalSeverity, number>;
  signals: SynthesisSignal[];
}

export interface CompassCategoryHealth {
  category: SynthesisCategoryId;
  label: string;
  present: number;
  draft: number;
  critical_missing: number;
  blocker_signals: number;
  warn_signals: number;
  health: CompassHealth;
}

export interface SynthesisCompass {
  project_id: string;
  categories: CompassCategoryHealth[];
  overall: CompassHealth;
}

export interface SynthesisRefreshResponse {
  project_id: string;
  source_count: number;
  auto_rebuild: boolean;
  regenerated: string[];
  failures: { type_id: string; error: string }[];
}

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

export interface ArtifactThreadRecord {
  id: string;
  project_id: string;
  artifact_id: string;
  title: string;
  comment_count: number;
  last_activity_at: string;
  created_at: string;
}

export interface ArtifactCommentRecord {
  id: string;
  thread_id: string;
  role: ArtifactCommentRole;
  author: string;
  body: string;
  turn_id: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

export interface ArtifactChatTurnResponse {
  turn_id: string;
  user: ArtifactCommentRecord;
  assistant: ArtifactCommentRecord;
}

export interface ArtifactPushResult {
  target: string;
  ok: boolean;
  commit?: string;
  files?: string[];
  message?: string;
}
