export interface RefineAgentDefinition {
  id: string;
  title: string;
  role: string;
  mission: string;
  goal: string;
  review_lens: string[];
  expected_outputs: string[];
  signature_questions: string[];
  work_item_focus: string[];
}

export interface RefineAgentArtifact {
  title: string;
  content: string;
  bullets: string[];
}

export interface RefineWorkItem {
  title: string;
  owner_role: string;
  priority: string;
  rationale: string;
  next_step: string;
}

export interface RefineAgentOpinion {
  agent_id: string;
  role: string;
  title: string;
  position: string;
  confidence: number;
  strengths: string[];
  concerns: string[];
  assumptions: string[];
  risks: string[];
  recommendations: string[];
  questions: string[];
  work_items: RefineWorkItem[];
  artifact: RefineAgentArtifact;
}

export interface RefineRoundtableTurn {
  phase: string;
  speaker_id: string;
  speaker: string;
  message: string;
  responds_to: string;
  decision_impact: string;
}

export interface RefineSolutionOption {
  title: string;
  value: string;
  effort: string;
  risk: string;
  evidence_fit: string;
  tradeoffs: string[];
}

export interface RefineSynthesis {
  consensus: string[];
  disagreements: string[];
  recommended_direction: string;
  solution_options: RefineSolutionOption[];
  validation_plan: string[];
  execute_readiness: string;
  decision_gate: "ready_for_execute" | "needs_validation" | "pivot" | "return_to_orchestrate" | string;
  confidence: number;
}

export interface RefineReview {
  id: string;
  discovery_id: string;
  version: number;
  parent_review_id: string;
  trigger_source: string;
  agent_ids: string[];
  opinions: RefineAgentOpinion[];
  roundtable: RefineRoundtableTurn[];
  synthesis: RefineSynthesis;
  user_instructions: string;
  context_used: string;
  created_at: string;
}

export interface RefineChatMessage {
  id: string;
  discovery_id: string;
  thread_type: "group" | "agent" | string;
  agent_id: string;
  speaker_id: string;
  speaker: string;
  role: "user" | "agent" | "system" | string;
  content: string;
  contribution_type: string;
  review_version: number;
  created_at: string;
}
