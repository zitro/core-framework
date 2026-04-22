/** Types for FDE-workflow features added in v0.4.0. */

export type EngagementStatus =
  | "proposed"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  proposed: "Proposed",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface Engagement {
  id: string;
  slug: string;
  name: string;
  customer: string;
  industry: string;
  summary: string;
  status: EngagementStatus;
  repo_path: string;
  discovery_ids: string[];
  owners: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** Project is the canonical name for an Engagement (one customer, many projects). */
export type Project = Engagement;

export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
};

export interface Review {
  id: string;
  discovery_id: string;
  artifact_collection: string;
  artifact_id: string;
  artifact_title: string;
  status: ReviewStatus;
  requested_by: string;
  reviewer: string;
  comment: string;
  created_at: string;
  decided_at: string | null;
}

export interface CompanyProfileSource {
  title: string;
  url: string;
}

export interface CompanyNewsItem {
  title: string;
  url: string;
  date?: string;
}

export interface CompanyProfile {
  company: string;
  industry: string;
  headquarters: string;
  size_estimate: string;
  summary: string;
  strategic_priorities: string[];
  products_services: string[];
  competitive_landscape: string[];
  recent_news: CompanyNewsItem[];
  open_questions: string[];
  sources: CompanyProfileSource[];
}

export interface CompanyProfileRecord {
  id: string;
  discovery_id: string;
  agent_id: string;
  company: string;
  user_instructions: string;
  result: CompanyProfile;
  created_at?: string;
}
