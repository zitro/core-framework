export interface UseCaseVersion {
  id: string;
  discovery_id: string;
  version: number;
  title: string;
  persona: string;
  goal: string;
  current_state: string;
  desired_state: string;
  business_value: string;
  business_impact: string;
  success_metrics: string[];
  summary: string;
  user_instructions: string;
  context_used: string;
  created_at: string;
}

export interface ServiceRecommendation {
  service: string;
  purpose: string;
  rationale: string;
}

export interface SolutionBlueprint {
  id: string;
  discovery_id: string;
  version: number;
  approach_title: string;
  approach_summary: string;
  services: ServiceRecommendation[];
  architecture_overview: string;
  quick_win_suggestion: string;
  estimated_effort: string;
  open_questions: string[];
  follow_up_questions: string[];
  target_providers: string[];
  user_instructions: string;
  context_used: string;
  created_at: string;
}
