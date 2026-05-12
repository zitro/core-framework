import type { ConfidenceLevel, CorePhase } from "./phases";

export type EvidenceType =
  | "general"
  | "observation"
  | "quote"
  | "pain_point"
  | "jtbd"
  | "assumption"
  | "hypothesis"
  | "insight";

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  general: "General",
  observation: "Observation",
  quote: "Quote",
  pain_point: "Pain Point",
  jtbd: "Job-to-be-Done",
  assumption: "Assumption",
  hypothesis: "Hypothesis",
  insight: "Insight",
};

export interface Evidence {
  id: string;
  discovery_id: string;
  phase: CorePhase;
  content: string;
  source: string;
  confidence: ConfidenceLevel;
  evidence_type: EvidenceType;
  tags: string[];
  created_at: string;
}

export interface Assumption {
  id: string;
  text: string;
  risk: "high" | "medium" | "low";
  status: "untested" | "validated" | "invalidated";
  certainty?: "high" | "medium" | "low" | "unknown";
  evidence?: string;
  validation_method?: string;
  owner?: string;
  impact_if_wrong?: string;
}
