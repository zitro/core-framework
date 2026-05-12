import type { CorePhase } from "./phases";

export interface Question {
  text: string;
  purpose: string;
  follow_ups: string[];
}

export interface QuestionGroundingSource {
  query: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface QuestionSet {
  id: string;
  discovery_id: string;
  phase: CorePhase;
  context: string;
  questions: Question[];
  grounding_sources?: QuestionGroundingSource[];
  created_at: string;
}
