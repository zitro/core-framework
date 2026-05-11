"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GitBranch,
  FolderSearch,
  CheckCircle,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Folder,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type {
  Discovery,
  EngagementSource,
  EngagementSourceType,
  EngagementScanResult,
  EngagementContentResult,
  EngagementExportResult,
  EngagementPublishResult,
  EngagementSourceUpdateStatus,
} from "@/types/core";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/http";
import { toast } from "sonner";

interface EngagementConfigProps {
  discovery: Discovery;
  onUpdate: (patch: Partial<Discovery>) => void;
}

interface SourceDuplicate {
  key: string;
  type: string;
  title: string;
  sources: string[];
  count: number;
}

interface SourceVersionGroup {
  key: string;
  type: string;
  title: string;
  entries: Array<{ source: string; path: string; excerpt: string }>;
}

const sourcesKey = (sources: EngagementSource[]) =>
  sources.map((source) => `${source.type}:${source.value}`).join("|");

export function EngagementConfig({ discovery, onUpdate }: EngagementConfigProps) {
  const normalizeSources = useCallback((d: Discovery): EngagementSource[] => {
    const normalized: EngagementSource[] = [];
    for (const source of d.engagement_sources || []) {
      const type = source.type === "repository" ? "repository" : "local_folder";
      const value = (source.value || "").trim();
      if (!value) continue;
      if (!normalized.some((s) => s.type === type && s.value === value)) {
        normalized.push({ type, value });
      }
    }
    for (const path of d.engagement_repo_paths || []) {
      const value = (path || "").trim();
      if (!value) continue;
      if (!normalized.some((s) => s.value === value)) {
        normalized.push({ type: "local_folder", value });
      }
    }
    const legacy = (d.engagement_repo_path || "").trim();
    if (legacy && !normalized.some((s) => s.value === legacy)) {
      normalized.push({ type: "local_folder", value: legacy });
    }
    return normalized;
  }, []);

  const [connectedSources, setConnectedSources] = useState<EngagementSource[]>(() => normalizeSources(discovery));
  const [localFolderPath, setLocalFolderPath] = useState(
    () => normalizeSources(discovery).find((s) => s.type === "local_folder")?.value || "",
  );
  const [repositoryPath, setRepositoryPath] = useState(
    () => normalizeSources(discovery).find((s) => s.type === "repository")?.value || "",
  );
  const [activePath, setActivePath] = useState(() => normalizeSources(discovery)[0]?.value || "");
  const [scan, setScan] = useState<EngagementScanResult | null>(null);
  const [scanningType, setScanningType] = useState<EngagementSourceType | null>(null);
  const [sourceEditor, setSourceEditor] = useState<EngagementSourceType | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<EngagementExportResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planResult, setPlanResult] = useState<EngagementPublishResult | null>(null);
  const [analyzingSources, setAnalyzingSources] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState("");
  const [githubBusy, setGithubBusy] = useState(false);
  const [sourceDuplicates, setSourceDuplicates] = useState<SourceDuplicate[]>([]);
  const [sourceVersions, setSourceVersions] = useState<SourceVersionGroup[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatuses, setUpdateStatuses] = useState<EngagementSourceUpdateStatus[]>([]);
  const [deletingSourceKey, setDeletingSourceKey] = useState<string | null>(null);
  const localFallbackSyncedRef = useRef<string | null>(null);
  const automationRef = useRef<Set<string>>(new Set());
  const autoScanAttemptRef = useRef<Set<string>>(new Set());

  const localSourcesKey = useMemo(
    () => `core:engagement-sources:${discovery.id || discovery.project_id || discovery.name}`,
    [discovery.id, discovery.project_id, discovery.name],
  );
  const sourceSnapshotKey = useMemo(
    () => `core:engagement-source-snapshots:${discovery.id || discovery.project_id || discovery.name}`,
    [discovery.id, discovery.project_id, discovery.name],
  );

  const fingerprintFromScan = useCallback((result: EngagementScanResult) => {
    const rows = (result.files || [])
      .map((item) => `${item.path}|${item.type || "other"}|${item.title || ""}`)
      .sort();
    return `${rows.length}:${rows.join("\n")}`;
  }, []);

  const readLocalSources = useCallback((): EngagementSource[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(localSourcesKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as EngagementSource[];
      return parsed
        .map((s) => ({
          type: (s.type === "repository" ? "repository" : "local_folder") as EngagementSourceType,
          value: (s.value || "").trim(),
        }))
        .filter((s) => s.value.length > 0);
    } catch {
      return [];
    }
  }, [localSourcesKey]);

  const normalizeSourcePath = useCallback((type: EngagementSourceType, value: string) => {
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

    const asPath = trimmed.startsWith("file://")
      ? (() => {
          try {
            const url = new URL(trimmed);
            let path = decodeURIComponent(url.pathname || "");
            // file:///C:/... -> C:/...
            if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1);
            return path;
          } catch {
            return trimmed;
          }
        })()
      : trimmed;
    if (type === "local_folder") {
      return asPath.replace(/\\/g, "/");
    }
    return asPath;
  }, []);

  const browseLocalFolder = useCallback(async () => {
    if (typeof window === "undefined") return;
    const pickerWindow = window as Window & {
      showDirectoryPicker?: () => Promise<{ name: string }>;
    };
    if (!pickerWindow.showDirectoryPicker) {
      toast.error("Folder picker is not supported in this browser. Paste the path manually.");
      return;
    }
    try {
      const handle = await pickerWindow.showDirectoryPicker();
      if (handle?.name) {
        // Browsers only expose the selected folder name. Keep that value
        // so backend path resolution can map it under PROJECTS_ROOT.
        const selectedFolder = handle.name;
        setLocalFolderPath(selectedFolder);
        toast.success(`Selected ${selectedFolder}`);
      } else {
        toast.error("Could not read the selected folder name. Paste the path manually.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error("Folder selection failed. Paste a mounted path manually (for example: /data/projects/<folder>). ");
    }
  }, []);

  const persistConnectedSources = useCallback(
    (sources: EngagementSource[]) => {
      const cleaned: EngagementSource[] = sources
        .map((s) => ({
          type: (s.type === "repository" ? "repository" : "local_folder") as EngagementSourceType,
          value: (s.value || "").trim(),
        }))
        .filter((s) => s.value.length > 0);
      setConnectedSources(cleaned);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(localSourcesKey, JSON.stringify(cleaned));
        } catch {
          /* ignore localStorage failures */
        }
      }
      const paths = cleaned.map((s) => s.value);
      onUpdate({
        engagement_repo_path: paths[0] ?? "",
        engagement_repo_paths: paths,
        engagement_sources: cleaned,
      } as Partial<Discovery>);
    },
    [localSourcesKey, onUpdate],
  );

  const addConnectedSource = useCallback(
    (type: EngagementSourceType, candidate: string) => {
      const trimmed = normalizeSourcePath(type, candidate);
      if (!trimmed) return;
      if (connectedSources.some((s) => s.type === type && s.value === trimmed)) return;
      persistConnectedSources([...connectedSources, { type, value: trimmed }]);
    },
    [connectedSources, normalizeSourcePath, persistConnectedSources],
  );

  const removeConnectedSource = useCallback(
    async (candidate: EngagementSource) => {
      const sourceKey = `${candidate.type}:${candidate.value}`;
      setDeletingSourceKey(sourceKey);
      const remaining = connectedSources.filter(
        (s) => !(s.type === candidate.type && s.value === candidate.value),
      );
      // Apply local state removal first so the UI responds immediately.
      persistConnectedSources(remaining);
      if (activePath === candidate.value) {
        setActivePath(remaining[0]?.value || "");
      }
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(sourceSnapshotKey);
          if (raw) {
            const current = JSON.parse(raw) as Record<string, string>;
            delete current[sourceKey];
            window.localStorage.setItem(sourceSnapshotKey, JSON.stringify(current));
          }
        } catch {
          /* ignore localStorage failures */
        }
      }
      setUpdateStatuses((prev) => prev.filter((s) => `${s.type}:${s.value}` !== sourceKey));

      try {
        if (discovery.id) {
          await api.engagement.deleteSource({
            discovery_id: discovery.id,
            source_type: candidate.type,
            source_value: candidate.value,
            purge_cached_data: true,
          });
        }
        toast.success("Source removed and cached source data purged");
      } catch {
        toast.warning("Source removed locally, but backend purge failed");
      } finally {
        setDeletingSourceKey(null);
      }
    },
    [activePath, connectedSources, discovery.id, persistConnectedSources, sourceSnapshotKey],
  );

  const checkSourceUpdates = useCallback(async () => {
    if (connectedSources.length === 0) return;
    setCheckingUpdates(true);
    try {
      let previous: Record<string, string> = {};
      if (typeof window !== "undefined") {
        try {
          previous = JSON.parse(window.localStorage.getItem(sourceSnapshotKey) || "{}") as Record<string, string>;
        } catch {
          previous = {};
        }
      }

      const next: Record<string, string> = { ...previous };
      const statuses: EngagementSourceUpdateStatus[] = [];

      for (const source of connectedSources) {
        const sourceKey = `${source.type}:${source.value}`;
        try {
          const result = await api.engagement.scan(source.value, { refresh: true });
          const currentFingerprint = fingerprintFromScan(result);
          const previousFingerprint = previous[sourceKey] || "";
          const changed = !!previousFingerprint && previousFingerprint !== currentFingerprint;
          next[sourceKey] = currentFingerprint;
          statuses.push({
            type: source.type,
            value: source.value,
            checked_at: new Date().toISOString(),
            changed,
            previous_fingerprint: previousFingerprint,
            current_fingerprint: currentFingerprint,
            file_count: result.files.length,
          });
        } catch (error) {
          statuses.push({
            type: source.type,
            value: source.value,
            checked_at: new Date().toISOString(),
            changed: false,
            previous_fingerprint: previous[sourceKey] || "",
            current_fingerprint: previous[sourceKey] || "",
            file_count: 0,
            error: error instanceof Error ? error.message : "Update check failed",
          });
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(sourceSnapshotKey, JSON.stringify(next));
      }
      setUpdateStatuses(statuses);

      const changedCount = statuses.filter((s) => s.changed).length;
      if (changedCount > 0) {
        toast.info(`${changedCount} source(s) have new or changed data available`);
      } else {
        toast.success("No source updates detected");
      }
    } finally {
      setCheckingUpdates(false);
    }
  }, [connectedSources, fingerprintFromScan, sourceSnapshotKey]);

  const doScan = useCallback(
    async (type: EngagementSourceType, overridePath?: string) => {
      const rawPath = overridePath ?? (type === "local_folder" ? localFolderPath : repositoryPath);
      const targetPath = normalizeSourcePath(type, rawPath);
      if (!targetPath) return;
      setScanningType(type);
      setScan(null);
      try {
        let resolvedPath = targetPath;
        let result: EngagementScanResult | null = null;

        if (type === "local_folder") {
          const trimmed = targetPath.trim();
          const candidates = [trimmed];
          if (!/[\\/]/.test(trimmed)) {
            candidates.push(`projects/${trimmed}`);
            candidates.push(`/data/projects/${trimmed}`);
          }

          let lastError: unknown = null;
          for (const candidate of candidates) {
            try {
              result = await api.engagement.scan(candidate);
              resolvedPath = candidate;
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (!result) {
            throw lastError ?? new Error("Scan failed");
          }
        } else {
          result = await api.engagement.scan(targetPath);
        }

        if (!result) {
          throw new Error("Scan returned no data");
        }
        setScan(result);
        setActivePath(resolvedPath);
        if (type === "local_folder") {
          setLocalFolderPath(resolvedPath);
        } else {
          setRepositoryPath(targetPath);
        }
        if (result.content_name) {
          addConnectedSource(type, resolvedPath);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scan failed";
        if (type === "local_folder") {
          const looksLikeFolderNameOnly = targetPath.length > 0 && !/[\\/]/.test(targetPath);
          const looksLikeWindowsPath = /^[A-Za-z]:[\\/]/.test(targetPath);
          if (looksLikeWindowsPath) {
            toast.error(
              "That Windows path is not visible inside the backend container. Use a mounted path like /data/projects/<folder> or a relative folder under PROJECTS_SOURCE.",
            );
          } else if (looksLikeFolderNameOnly) {
            toast.error(
              `Could not find '${targetPath}' in mounted projects. Try a mounted path such as /data/projects/${targetPath}, or update PROJECTS_SOURCE to include your folder.`,
            );
          } else {
            toast.error(
              `${message}. Use a path the backend can access (for example: /data/projects/<folder> or a relative folder under PROJECTS_SOURCE).`,
            );
          }
        } else {
          toast.error(`${message}. If the GitHub repository is private, set GITHUB_TOKEN for backend access.`);
        }
      } finally {
        setScanningType(null);
      }
    },
    [localFolderPath, repositoryPath, addConnectedSource, normalizeSourcePath],
  );

  const addAndScanSource = useCallback(
    async (type: EngagementSourceType, value: string) => {
      const trimmed = normalizeSourcePath(type, value);
      if (!trimmed || scanningType !== null) return;

      // Only persist source on successful scan to avoid stale "connected" rows.
      await doScan(type, trimmed);
    },
    [scanningType, doScan, normalizeSourcePath],
  );

  const doExport = useCallback(async () => {
    if (!discovery.id || !activePath.trim()) return;
    setExporting(true);
    setExportResult(null);
    try {
      const result = await api.engagement.export({
        discovery_id: discovery.id,
        repo_path: activePath.trim(),
      });
      setExportResult(result);
      toast.success(`Exported ${result.count} files`);
    } catch {
      /* toast handled by api */
    } finally {
      setExporting(false);
    }
  }, [discovery.id, activePath]);

  const doPlanPublish = useCallback(async () => {
    if (!discovery.id || connectedSources.length === 0) return;
    setPlanning(true);
    try {
      const result = await api.engagement.publish({
        discovery_id: discovery.id,
        repo_paths: connectedSources.map((s) => s.value),
        dry_run: true,
        use_ai_placement: true,
      });
      setPlanResult(result);
      toast.success(`Auto plan publish ready (${result.count} items)`);
    } catch {
      /* toast handled by api */
    } finally {
      setPlanning(false);
    }
  }, [connectedSources, discovery.id]);

  const normalizeText = useCallback((value: string) => {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }, []);

  const sourceAlias = useCallback((value: string) => {
    const cleaned = value.replace(/^https?:\/\//i, "").replace(/^file:\/\//i, "");
    return cleaned.length > 54 ? `${cleaned.slice(0, 54)}...` : cleaned;
  }, []);

  const isVersionType = useCallback((type: string) => {
    const t = normalizeText(type);
    return t.includes("problem") || t.includes("use-case") || t.includes("use case");
  }, [normalizeText]);

  const analyzeSources = useCallback(async () => {
    if (connectedSources.length < 2) {
      setSourceDuplicates([]);
      setSourceVersions([]);
      return;
    }

    setAnalyzingSources(true);
    try {
      const loaded = await Promise.all(
        connectedSources.map(async (source) => {
          try {
            const content = await api.engagement.content(source.value);
            return { source: source.value, content };
          } catch {
            return { source: source.value, content: null as EngagementContentResult | null };
          }
        }),
      );

      const duplicatesMap = new Map<string, { type: string; title: string; sources: Set<string> }>();
      const versionsMap = new Map<string, SourceVersionGroup>();

      for (const loadedSource of loaded) {
        if (!loadedSource.content) continue;
        for (const file of loadedSource.content.content) {
          const normalizedType = normalizeText(file.type || "other");
          const normalizedTitle = normalizeText(file.title || file.path);
          const normalizedBody = normalizeText((file.body || "").slice(0, 1400));
          const duplicateKey = `${normalizedType}|${normalizedTitle}|${normalizedBody}`;
          const current = duplicatesMap.get(duplicateKey) ?? {
            type: file.type || "other",
            title: file.title || file.path,
            sources: new Set<string>(),
          };
          current.sources.add(loadedSource.source);
          duplicatesMap.set(duplicateKey, current);

          if (isVersionType(file.type || "")) {
            const versionGroupKey = `${normalizedType}|${normalizedTitle}`;
            const group = versionsMap.get(versionGroupKey) ?? {
              key: versionGroupKey,
              type: file.type || "other",
              title: file.title || file.path,
              entries: [],
            };
            const entryKey = `${loadedSource.source}:${file.path}`;
            if (!group.entries.some((e) => `${e.source}:${e.path}` === entryKey)) {
              group.entries.push({
                source: loadedSource.source,
                path: file.path,
                excerpt: (file.body || "").replace(/\s+/g, " ").trim().slice(0, 180),
              });
            }
            versionsMap.set(versionGroupKey, group);
          }
        }
      }

      const duplicates = Array.from(duplicatesMap.entries())
        .map(([key, value]) => ({
          key,
          type: value.type,
          title: value.title,
          sources: Array.from(value.sources),
          count: value.sources.size,
        }))
        .filter((item) => item.count > 1)
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

      const versions = Array.from(versionsMap.values())
        .filter((group) => group.entries.length > 1)
        .sort((a, b) => b.entries.length - a.entries.length || a.title.localeCompare(b.title));

      setSourceDuplicates(duplicates);
      setSourceVersions(versions);
      if (duplicates.length > 0) {
        toast.info(`Detected ${duplicates.length} duplicate item groups across connected sources`);
      }
    } finally {
      setAnalyzingSources(false);
    }
  }, [connectedSources, isVersionType, normalizeText]);

  const refreshGithubStatus = useCallback(async () => {
    try {
      const status = await api.githubAuth.status();
      setGithubConnected(status.connected);
      setGithubLogin(status.login || "");
    } catch {
      setGithubConnected(false);
      setGithubLogin("");
    }
  }, []);

  const connectGithub = useCallback(async () => {
    if (githubBusy) return;
    setGithubBusy(true);

    const apiOrigin = (() => {
      try {
        return new URL(API_URL).origin;
      } catch {
        return window.location.origin;
      }
    })();

    await new Promise<void>((resolve) => {
      let resolved = false;

      const complete = () => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener("message", onMessage);
        resolve();
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== apiOrigin) return;
        if (!event.data || event.data.type !== "github-oauth") return;
        if (event.data.success) {
          toast.success("GitHub connected");
        } else {
          toast.error(event.data.error || "GitHub OAuth failed");
        }
        complete();
      };

      window.addEventListener("message", onMessage);
      const popup = window.open(
        `${API_URL}/api/github/oauth/start`,
        "core-github-oauth",
        "popup,width=540,height=720",
      );

      if (!popup) {
        toast.error("Popup blocked. Allow popups and try again.");
        complete();
        return;
      }

      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          complete();
        }
      }, 500);

      window.setTimeout(() => {
        window.clearInterval(timer);
        complete();
      }, 180000);
    });

    await refreshGithubStatus();
    setGithubBusy(false);
  }, [githubBusy, refreshGithubStatus]);

  const disconnectGithub = useCallback(async () => {
    setGithubBusy(true);
    try {
      await api.githubAuth.disconnect();
      toast.success("GitHub disconnected");
    } catch {
      /* toast handled by api */
    } finally {
      await refreshGithubStatus();
      setGithubBusy(false);
    }
  }, [refreshGithubStatus]);

  // Auto-scan if path is already set
  useEffect(() => {
    const normalized = normalizeSources(discovery);
    const localFallback = normalized.length === 0 ? readLocalSources() : [];
    const effectiveSources = normalized.length > 0 ? normalized : localFallback;

    setConnectedSources((current) =>
      sourcesKey(current) === sourcesKey(effectiveSources) ? current : effectiveSources,
    );
    const localSource = effectiveSources.find((s) => s.type === "local_folder")?.value;
    const repoSource = effectiveSources.find((s) => s.type === "repository")?.value;
    // Avoid clobbering in-progress user input when no source has been added yet.
    if (localSource) {
      setLocalFolderPath(localSource);
    }
    if (repoSource) {
      setRepositoryPath(repoSource);
    }

    if (normalized.length === 0 && localFallback.length > 0 && localFallbackSyncedRef.current !== localSourcesKey) {
      localFallbackSyncedRef.current = localSourcesKey;
      const paths = localFallback.map((s) => s.value);
      onUpdate({
        engagement_repo_path: paths[0] ?? "",
        engagement_repo_paths: paths,
        engagement_sources: localFallback,
      } as Partial<Discovery>);
    } else if (normalized.length > 0) {
      localFallbackSyncedRef.current = null;
    }

    if (effectiveSources.length > 0) {
      const primary = effectiveSources[0];
      const scanPath = normalizeSourcePath(primary.type, primary.value);
      const scanKey = `${discovery.id || "unknown"}:${primary.type}:${scanPath}`;
      if (!autoScanAttemptRef.current.has(scanKey)) {
        autoScanAttemptRef.current.add(scanKey);
        setActivePath(primary.value);
        void doScan(primary.type, primary.value);
      }
    }
  }, [discovery, doScan, localSourcesKey, normalizeSources, normalizeSourcePath, onUpdate, readLocalSources]);

  // On successful scan: auto-export, auto-plan publish (dry run), and
  // cross-source analysis for duplicates + version provenance.
  useEffect(() => {
    if (!discovery.id || !scan || scan.error || !activePath.trim()) return;
    const sourceCount = connectedSources.length;
    if (sourceCount === 0) return;
    const sourceKey = connectedSources
      .map((s) => `${s.type}:${s.value}`)
      .sort()
      .join("|");
    const key = `${discovery.id}:${activePath.trim()}:${sourceKey}`;
    if (automationRef.current.has(key)) return;
    automationRef.current.add(key);

    void (async () => {
      await doExport();
      await doPlanPublish();
      await analyzeSources();
    })();
  }, [activePath, analyzeSources, connectedSources, discovery.id, doExport, doPlanPublish, scan]);

  useEffect(() => {
    if (sourceEditor !== "repository") return;
    void refreshGithubStatus();
  }, [refreshGithubStatus, sourceEditor]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <span>Engagement Source</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Link a structured markdown repo to feed notes into AI context and export CORE outputs back.
        </p>
      </header>
      <div className="space-y-4">
        {/* Source actions */}
        <div className="rounded-lg border border-dashed p-3 space-y-3">
          {githubConnected && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-2">
              <Badge variant="secondary" className="text-[10px]">
                {`GitHub Connected${githubLogin ? ` (${githubLogin})` : ""}`}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => void disconnectGithub()} disabled={githubBusy}>
                {githubBusy ? "Disconnecting..." : "Disconnect GitHub"}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={sourceEditor === "local_folder" ? "default" : "outline"}
              onClick={() => setSourceEditor(sourceEditor === "local_folder" ? null : "local_folder")}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Local Folder
            </Button>
            <Button
              size="sm"
              variant={sourceEditor === "repository" ? "default" : "outline"}
              onClick={() => setSourceEditor(sourceEditor === "repository" ? null : "repository")}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              GitHub Repo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void checkSourceUpdates()}
              disabled={checkingUpdates || connectedSources.length === 0 || scanningType !== null}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {checkingUpdates ? "Checking..." : "Check Updates"}
            </Button>
          </div>

          {sourceEditor === "local_folder" && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <div className="text-sm font-medium">Local Folder</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="min-w-[260px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="C:/path/to/local-folder"
                  value={localFolderPath}
                  onChange={(e) => setLocalFolderPath(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void browseLocalFolder()}
                  disabled={scanningType === "local_folder"}
                >
                  <Folder className="mr-1.5 h-3.5 w-3.5" />
                  Browse
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void addAndScanSource("local_folder", localFolderPath)}
                  disabled={!localFolderPath.trim() || scanningType === "local_folder"}
                >
                  {scanningType === "local_folder" ? "Adding..." : "Add"}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Add automatically validates and scans the folder.
              </div>
            </div>
          )}

          {sourceEditor === "repository" && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <div className="text-sm font-medium">GitHub Repository</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="min-w-[260px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="https://github.com/org/repo or C:/path/to/cloned-repo"
                  value={repositoryPath}
                  onChange={(e) => setRepositoryPath(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void addAndScanSource("repository", repositoryPath)}
                  disabled={!repositoryPath.trim() || scanningType === "repository"}
                >
                  {scanningType === "repository" ? "Connecting..." : "Connect"}
                </Button>
                {!githubConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void connectGithub()}
                    disabled={githubBusy}
                  >
                    {githubBusy ? "Opening..." : "Connect GitHub"}
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Connect validates and scans local clones or GitHub URLs automatically. Public repos work directly; private repos require GitHub connection or a local GITHUB_TOKEN.
              </div>
            </div>
          )}
        </div>

        {connectedSources.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Connected sources</div>
            <div className="space-y-1.5">
              {connectedSources.map((source, index) => (
                <div key={`${source.type}:${source.value}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {source.type === "repository" ? (
                      <span className="inline-flex items-center gap-1"><Link className="h-3 w-3" />Repo</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Folder className="h-3 w-3" />Local</span>
                    )}
                  </Badge>
                  <code className="min-w-0 flex-1 truncate text-xs">{source.value}</code>
                  {index === 0 && (
                    <Badge variant="secondary" className="text-[10px]">Primary</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActivePath(source.value);
                      if (source.type === "local_folder") {
                        setLocalFolderPath(source.value);
                      } else {
                        setRepositoryPath(source.value);
                      }
                      void doScan(source.type, source.value);
                    }}
                    disabled={scanningType !== null}
                  >
                    <FolderSearch className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void removeConnectedSource(source);
                    }}
                    disabled={deletingSourceKey === `${source.type}:${source.value}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {updateStatuses.length > 0 && (
          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
            <div className="font-medium">Source update status</div>
            <ul className="space-y-1 text-xs text-muted-foreground max-h-40 overflow-y-auto">
              {updateStatuses.map((status) => (
                <li key={`${status.type}:${status.value}`}>
                  • {sourceAlias(status.value)}: {status.error ? `error (${status.error})` : status.changed ? "updated" : "no changes"} — {status.file_count} files
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Scan results */}
        {scan && !scan.error && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="font-medium">{scan.content_name}</span>
                <Badge variant="outline" className="text-xs">
                  {scan.files.length} files
                </Badge>
              </div>

              {scan.projects.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Projects:{" "}
                  {scan.projects.map((i) => (
                    <Badge key={i} variant="secondary" className="mr-1 text-xs">
                      {i}
                    </Badge>
                  ))}
                </div>
              )}

              {/* File type breakdown */}
              <div className="flex flex-wrap gap-1">
                {Object.entries(
                  scan.files.reduce(
                    (acc, f) => {
                      const t = f.type || "other";
                      acc[t] = (acc[t] || 0) + 1;
                      return acc;
                    },
                    {} as Record<string, number>
                  )
                ).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <FileText className="mr-1 inline h-3.5 w-3.5" />
                {exporting
                  ? "Auto-exporting CORE artifacts"
                  : planning
                    ? "Auto planning publish across connected sources"
                    : analyzingSources
                      ? "AI analyzing cross-source duplicates and versions"
                      : "Auto export + plan publish + source analysis complete"}
              </div>
            </div>

            {exportResult && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <span className="font-medium">
                  {exportResult.count} files exported
                </span>{" "}
                to{" "}
                <code className="text-xs">{exportResult.target_dir}</code>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {exportResult.exported.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}

            {planResult && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <div className="font-medium">
                  Auto plan publish: {planResult.count} items
                </div>
                <div className="text-xs text-muted-foreground">
                  Skipped: {planResult.skipped.length} | Errors: {planResult.errors.length}
                </div>
              </div>
            )}

            {(sourceDuplicates.length > 0 || sourceVersions.length > 0 || connectedSources.length > 1) && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
                <div className="font-medium">Cross-source analysis</div>
                {sourceDuplicates.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Duplicate groups (not re-ingested)
                    </div>
                    <ul className="space-y-0.5 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                      {sourceDuplicates.slice(0, 20).map((dup) => (
                        <li key={dup.key}>
                          • {dup.type || "other"} | {dup.title} | sources: {dup.sources.map(sourceAlias).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No duplicate items detected across current sources.</div>
                )}

                {sourceVersions.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Multi-version findings (showing provenance)
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground max-h-40 overflow-y-auto">
                      {sourceVersions.slice(0, 20).map((group) => (
                        <li key={group.key}>
                          <div>• {group.type || "other"} | {group.title}</div>
                          {group.entries.map((entry) => (
                            <div key={`${entry.source}:${entry.path}`} className="pl-3">
                              - {sourceAlias(entry.source)} :: {entry.path}
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {scan?.error && (
          <p className="text-sm text-destructive">{scan.error}</p>
        )}
      </div>
    </section>
  );
}
