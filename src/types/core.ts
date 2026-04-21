export type CorePhase = "capture" | "orient" | "refine" | "execute";
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
}

export interface Discovery {
  id: string;
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
  engagement_repo_path: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  text: string;
  purpose: string;
  follow_ups: string[];
}

export interface QuestionSet {
  id: string;
  discovery_id: string;
  phase: CorePhase;
  context: string;
  questions: Question[];
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
  orient: {
    label: "Orient",
    description: "Recognize patterns, frame the real problem, sensemaking",
    icon: "Compass",
    color: "amber",
  },
  refine: {
    label: "Refine",
    description: "Imagine solutions, simulate and test assumptions",
    icon: "Lightbulb",
    color: "emerald",
  },
  execute: {
    label: "Execute",
    description: "Deliver quick win, mobilize for bigger build",
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
