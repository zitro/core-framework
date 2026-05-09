export type CorePhase = "capture" | "orchestrate" | "refine" | "execute";
export type DiscoveryMode = "standard" | "fde" | "workshop_sprint";
export type ConfidenceLevel = "validated" | "assumed" | "unknown" | "conflicting";

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

export interface Stakeholder {
  name: string;
  role: string;
  influence: string;
  notes: string;
}

export interface ProblemStatement {
  who: string;
  what: string;
  why: string;
  impact: string;
  statement: string;
  confidence: ConfidenceLevel;
}

export interface QuickWin {
  id: string;
  title: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  owner: string;
  done: boolean;
}

export interface Blocker {
  id: string;
  description: string;
  severity: "critical" | "major" | "minor";
  mitigation: string;
  resolved: boolean;
}

export interface ExecuteData {
  quick_wins: QuickWin[];
  blockers: Blocker[];
  handoff_notes: string;
}

export interface ExecuteOutputVersion {
  id: string;
  discovery_id: string;
  output_id: string;
  title: string;
  description: string;
  audience: "executive" | "technical" | "customer" | "internal" | string;
  style: "narrative" | "brief" | "outline" | string;
  category: "stakeholder" | "delivery" | "technical" | string;
  version: number;
  headline: string;
  summary: string;
  sections: Array<{ title: string; body: string }>;
  focus: string;
  context_fingerprint: string;
  context_used: string;
  created_at: string;
}

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

export interface TechnologyTarget {
  name: string;
  focus: string;
}

export type EngagementSourceType = "local_folder" | "repository";

export interface EngagementSource {
  type: EngagementSourceType;
  value: string;
}

export interface EngagementSourceDeleteResult {
  discovery_id: string;
  removed: { type: string; value: string };
  remaining_sources: number;
  remaining_paths: string[];
  purged_cached_data: boolean;
}

export interface EngagementSourceUpdateStatus {
  type: EngagementSourceType;
  value: string;
  checked_at: string;
  changed: boolean;
  previous_fingerprint: string;
  current_fingerprint: string;
  file_count: number;
  error?: string;
}

export interface Discovery {
  id: string;
  project_id: string;
  name: string;
  description: string;
  mode: DiscoveryMode;
  current_phase: CorePhase;
  stakeholders: Stakeholder[];
  problem_statement: ProblemStatement | null;
  execute_data: ExecuteData | null;
  assumptions: Assumption[];
  solution_matches: SolutionMatch[];
  evidence: Evidence[];
  docs_path: string;
  solution_providers: string[];
  target_technologies?: TechnologyTarget[];
  engagement_repo_path: string;
  engagement_repo_paths?: string[];
  engagement_sources?: EngagementSource[];
  created_at: string;
  updated_at: string;
}

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

export interface TranscriptInsight {
  text: string;
  confidence: ConfidenceLevel;
  phase: CorePhase;
}

export interface TranscriptAnalysis {
  id: string;
  discovery_id: string;
  transcript_text: string;
  insights: TranscriptInsight[];
  evidence_extracted: Evidence[];
  sentiment: string;
  key_themes: string[];
  created_at: string;
}

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

export interface SolutionMatch {
  problem: string;
  capabilities: string[];
  gap: string;
  confidence: number;
}

export interface SolutionMatchResult {
  matches: SolutionMatch[];
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

export interface EngagementScanResult {
  path: string;
  content_dir: string | null;
  content_name: string;
  projects: string[];
  files: { path: string; type: string; title: string }[];
  error?: string;
}

export interface EngagementExportResult {
  exported: string[];
  skipped?: { collection: string; id: string; status: string }[];
  count: number;
  target_dir: string;
}

export interface EngagementContentFile {
  path: string;
  type: string;
  type_label: string;
  title: string;
  frontmatter: Record<string, string | string[]>;
  body: string;
  project: string | null;
}

export interface EngagementContentResult {
  path: string;
  content_name: string;
  projects: string[];
  content: EngagementContentFile[];
}

export interface IngestClassification {
  classification: {
    type: string;
    title: string;
    confidence: "high" | "medium" | "low";
  };
  placement: {
    directory: string;
    filename: string;
    action: "create" | "append";
    append_target: string;
  };
  generated_content: string;
  summary: string;
  content_dir: string;
}

export interface IngestWriteResult {
  path: string;
  full_path: string;
  action: string;
}

export interface EngagementPublishItem {
  repo_path: string;
  collection: string;
  id: string;
  filename: string;
  directory: string;
  action: string;
  append_target: string;
  placement_confidence: string;
  dry_run: boolean;
  written_path?: string;
}

export interface EngagementPublishResult {
  discovery_id: string;
  dry_run: boolean;
  use_ai_placement: boolean;
  repo_paths: string[];
  count: number;
  published: EngagementPublishItem[];
  skipped: { repo_path: string; collection: string; id: string; status: string }[];
  errors: { repo_path: string; collection?: string; id?: string; error: string }[];
}

export const PHASE_CONFIG: Record<
  CorePhase,
  { label: string; description: string; icon: string; color: string }
> = {
  capture: {
    label: "Capture",
    description: "Probe the system, gather evidence, map stakeholders",
    icon: "Search",
    color: "blue",
  },
  orchestrate: {
    label: "Orchestrate",
    description: "Synthesize evidence, frame the real problem, and align direction",
    icon: "Compass",
    color: "amber",
  },
  refine: {
    label: "Refine",
    description: "Expert review, validation, and recommendation shaping",
    icon: "Lightbulb",
    color: "emerald",
  },
  execute: {
    label: "Execute",
    description: "Generate final artifacts, updates, and handoff packages",
    icon: "Rocket",
    color: "violet",
  },
};

export const MODE_CONFIG: Record<
  DiscoveryMode,
  { label: string; description: string; duration: string }
> = {
  standard: {
    label: "Standard Discovery",
    description: "Full CORE cycle for deep product discovery",
    duration: "2-6 weeks",
  },
  fde: {
    label: "Forward Deployed Engineering",
    description: "Embedded discovery with hands-on delivery",
    duration: "4-12 weeks",
  },
  workshop_sprint: {
    label: "Workshop Sprint",
    description: "Rapid 2-3 day engagement: one quick win + blocker map",
    duration: "2-3 days",
  },
};
