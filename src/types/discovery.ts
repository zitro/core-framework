import type { CorePhase, DiscoveryMode } from "./phases";
import type { Assumption, Evidence } from "./evidence";
import type { ProblemStatement, SolutionMatch } from "./problem";
import type { ExecuteData } from "./execute";
import type { EngagementSource } from "./engagement";

export interface Stakeholder {
  name: string;
  role: string;
  influence: string;
  notes: string;
}

export interface TechnologyTarget {
  name: string;
  focus: string;
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
