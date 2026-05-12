import type {
  EngagementScanResult,
  EngagementSource,
  EngagementSourceType,
} from "@/types/core";

export interface SourceDuplicate {
  key: string;
  type: string;
  title: string;
  sources: string[];
  count: number;
}

export interface SourceVersionGroup {
  key: string;
  type: string;
  title: string;
  entries: Array<{ source: string; path: string; excerpt: string }>;
}

export function sourcesKey(sources: EngagementSource[]): string {
  return sources.map((source) => `${source.type}:${source.value}`).join("|");
}

export function fingerprintFromScan(result: EngagementScanResult): string {
  const rows = (result.files || [])
    .map((item) => `${item.path}|${item.type || "other"}|${item.title || ""}`)
    .sort();
  return `${rows.length}:${rows.join("\n")}`;
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function sourceAlias(value: string): string {
  const cleaned = value.replace(/^https?:\/\//i, "").replace(/^file:\/\//i, "");
  return cleaned.length > 54 ? `${cleaned.slice(0, 54)}...` : cleaned;
}

export function isVersionType(type: string): boolean {
  const t = normalizeText(type);
  return t.includes("problem") || t.includes("use-case") || t.includes("use case");
}

export function normalizeSourcePath(type: EngagementSourceType, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (type === "repository") {
    const sshMatch = /^git@github\.com:([^/]+)\/([^\s]+?)(?:\.git)?\/?$/i.exec(trimmed);
    if (sshMatch) {
      return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
    }
    const sshUrlMatch = /^ssh:\/\/git@github\.com\/([^/]+)\/([^\s]+?)(?:\.git)?\/?$/i.exec(trimmed);
    if (sshUrlMatch) {
      return `https://github.com/${sshUrlMatch[1]}/${sshUrlMatch[2]}`;
    }
    if (/^github\.com\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
  }

  let asPath = trimmed;
  if (trimmed.startsWith("file://")) {
    try {
      const url = new URL(trimmed);
      let path = decodeURIComponent(url.pathname || "");
      if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1);
      asPath = path;
    } catch {
      asPath = trimmed;
    }
  }
  if (type === "local_folder") {
    return asPath.replace(/\\/g, "/");
  }
  return asPath;
}

export function cleanSources(sources: EngagementSource[]): EngagementSource[] {
  return sources
    .map((s) => ({
      type: (s.type === "repository" ? "repository" : "local_folder") as EngagementSourceType,
      value: (s.value || "").trim(),
    }))
    .filter((s) => s.value.length > 0);
}

export function readLocalSources(localSourcesKey: string): EngagementSource[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(localSourcesKey);
    if (!raw) return [];
    return cleanSources(JSON.parse(raw) as EngagementSource[]);
  } catch {
    return [];
  }
}

export function normalizeDiscoverySources(
  engagementSources: EngagementSource[] | undefined,
  repoPaths: string[] | undefined,
  legacyRepoPath: string | undefined,
): EngagementSource[] {
  const normalized: EngagementSource[] = [];
  for (const source of engagementSources || []) {
    const type = source.type === "repository" ? "repository" : "local_folder";
    const value = (source.value || "").trim();
    if (!value) continue;
    if (!normalized.some((s) => s.type === type && s.value === value)) {
      normalized.push({ type, value });
    }
  }
  for (const path of repoPaths || []) {
    const value = (path || "").trim();
    if (!value) continue;
    if (!normalized.some((s) => s.value === value)) {
      normalized.push({ type: "local_folder", value });
    }
  }
  const legacy = (legacyRepoPath || "").trim();
  if (legacy && !normalized.some((s) => s.value === legacy)) {
    normalized.push({ type: "local_folder", value: legacy });
  }
  return normalized;
}
