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
