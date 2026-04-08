export type CorePhase = "capture" | "orient" | "refine" | "execute";
export type DiscoveryMode = "standard" | "fde" | "workshop_sprint";
export type ConfidenceLevel = "validated" | "assumed" | "unknown" | "conflicting";

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

export interface Evidence {
  id: string;
  discovery_id: string;
  phase: CorePhase;
  content: string;
  source: string;
  confidence: ConfidenceLevel;
  tags: string[];
  created_at: string;
}

export interface Discovery {
  id: string;
  name: string;
  description: string;
  mode: DiscoveryMode;
  current_phase: CorePhase;
  stakeholders: Stakeholder[];
  problem_statement: ProblemStatement | null;
  evidence: Evidence[];
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
