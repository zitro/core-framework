import type { ConfidenceLevel } from "./phases";

export interface ProblemStatement {
  who: string;
  what: string;
  why: string;
  impact: string;
  statement: string;
  confidence: ConfidenceLevel;
}

export interface ProblemStatementVersion {
  id: string;
  discovery_id: string;
  version: number;
  who: string;
  what: string;
  why: string;
  impact: string;
  statement: string;
  user_instructions: string;
  context_used: string;
  created_at: string;
}

export interface SolutionMatch {
  problem: string;
  capabilities: string[];
  gap: string;
  confidence: number;
}

export interface SolutionMatchResult {
  matches: SolutionMatch[];
}
