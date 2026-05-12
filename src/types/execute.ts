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
