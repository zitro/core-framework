export interface ContextBriefVersion {
  id: string;
  discovery_id: string;
  version: number;
  title: string;
  summary: string;
  goals: string[];
  stakeholders: string[];
  constraints: string[];
  risks: string[];
  open_questions: string[];
  evidence_summary: string;
  user_instructions: string;
  context_used: string;
  context_fingerprint: string;
  created_at: string;
}
