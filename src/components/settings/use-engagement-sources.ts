"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  Discovery,
  EngagementScanResult,
  EngagementSource,
  EngagementSourceType,
  EngagementSourceUpdateStatus,
} from "@/types/core";
import { api } from "@/lib/api";
import {
  cleanSources,
  normalizeDiscoverySources,
  normalizeSourcePath,
  readLocalSources,
  sourcesKey,
} from "./engagement-helpers";
import { runScan } from "./engagement-scan-runner";
import { removeSnapshotEntry, runCheckSourceUpdates } from "./engagement-source-updates";
import { useEngagementAutomations, type UseEngagementAutomationsResult } from "./use-engagement-automations";

export interface UseEngagementSourcesResult extends UseEngagementAutomationsResult {
  connectedSources: EngagementSource[];
  localFolderPath: string;
  setLocalFolderPath: (value: string) => void;
  repositoryPath: string;
  setRepositoryPath: (value: string) => void;
  scan: EngagementScanResult | null;
  scanningType: EngagementSourceType | null;
  checkingUpdates: boolean;
  updateStatuses: EngagementSourceUpdateStatus[];
  deletingSourceKey: string | null;
  addAndScanSource: (type: EngagementSourceType, value: string) => Promise<void>;
  removeConnectedSource: (source: EngagementSource) => Promise<void>;
  checkSourceUpdates: () => Promise<void>;
  selectSource: (source: EngagementSource) => void;
}

export function useEngagementSources(
  discovery: Discovery,
  onUpdate: (patch: Partial<Discovery>) => void,
): UseEngagementSourcesResult {
  const initialSources = useMemo(
    () => normalizeDiscoverySources(
      discovery.engagement_sources,
      discovery.engagement_repo_paths,
      discovery.engagement_repo_path,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [connectedSources, setConnectedSources] = useState<EngagementSource[]>(initialSources);
  const [localFolderPath, setLocalFolderPath] = useState(
    () => initialSources.find((s) => s.type === "local_folder")?.value || "",
  );
  const [repositoryPath, setRepositoryPath] = useState(
    () => initialSources.find((s) => s.type === "repository")?.value || "",
  );
  const [activePath, setActivePath] = useState(() => initialSources[0]?.value || "");
  const [scan, setScan] = useState<EngagementScanResult | null>(null);
  const [scanningType, setScanningType] = useState<EngagementSourceType | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatuses, setUpdateStatuses] = useState<EngagementSourceUpdateStatus[]>([]);
  const [deletingSourceKey, setDeletingSourceKey] = useState<string | null>(null);

  const localFallbackSyncedRef = useRef<string | null>(null);
  const autoScanAttemptRef = useRef<Set<string>>(new Set());

  const localSourcesKey = useMemo(
    () => `core:engagement-sources:${discovery.id || discovery.project_id || discovery.name}`,
    [discovery.id, discovery.project_id, discovery.name],
  );
  const sourceSnapshotKey = useMemo(
    () => `core:engagement-source-snapshots:${discovery.id || discovery.project_id || discovery.name}`,
    [discovery.id, discovery.project_id, discovery.name],
  );

  const persistConnectedSources = useCallback(
    (sources: EngagementSource[]) => {
      const cleaned = cleanSources(sources);
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
    [connectedSources, persistConnectedSources],
  );

  const doScan = useCallback(
    async (type: EngagementSourceType, overridePath?: string) => {
      const rawPath = overridePath ?? (type === "local_folder" ? localFolderPath : repositoryPath);
      if (!normalizeSourcePath(type, rawPath)) return;

      setScanningType(type);
      setScan(null);
      const outcome = await runScan(type, rawPath);
      if (outcome) {
        setScan(outcome.result);
        setActivePath(outcome.resolvedPath);
        if (type === "local_folder") {
          setLocalFolderPath(outcome.resolvedPath);
        } else {
          setRepositoryPath(normalizeSourcePath(type, rawPath));
        }
        if (outcome.result.content_name) {
          addConnectedSource(type, outcome.resolvedPath);
        }
      }
      setScanningType(null);
    },
    [localFolderPath, repositoryPath, addConnectedSource],
  );

  const removeConnectedSource = useCallback(
    async (candidate: EngagementSource) => {
      const key = `${candidate.type}:${candidate.value}`;
      setDeletingSourceKey(key);
      const remaining = connectedSources.filter(
        (s) => !(s.type === candidate.type && s.value === candidate.value),
      );
      persistConnectedSources(remaining);
      if (activePath === candidate.value) {
        setActivePath(remaining[0]?.value || "");
      }
      removeSnapshotEntry(sourceSnapshotKey, key);
      setUpdateStatuses((prev) => prev.filter((s) => `${s.type}:${s.value}` !== key));

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
      const statuses = await runCheckSourceUpdates(connectedSources, sourceSnapshotKey);
      setUpdateStatuses(statuses);
    } finally {
      setCheckingUpdates(false);
    }
  }, [connectedSources, sourceSnapshotKey]);

  const addAndScanSource = useCallback(
    async (type: EngagementSourceType, value: string) => {
      const trimmed = normalizeSourcePath(type, value);
      if (!trimmed || scanningType !== null) return;
      await doScan(type, trimmed);
    },
    [scanningType, doScan],
  );

  const selectSource = useCallback(
    (source: EngagementSource) => {
      setActivePath(source.value);
      if (source.type === "local_folder") {
        setLocalFolderPath(source.value);
      } else {
        setRepositoryPath(source.value);
      }
      void doScan(source.type, source.value);
    },
    [doScan],
  );

  useEffect(() => {
    const normalized = normalizeDiscoverySources(
      discovery.engagement_sources,
      discovery.engagement_repo_paths,
      discovery.engagement_repo_path,
    );
    const localFallback = normalized.length === 0 ? readLocalSources(localSourcesKey) : [];
    const effectiveSources = normalized.length > 0 ? normalized : localFallback;

    setConnectedSources((current) =>
      sourcesKey(current) === sourcesKey(effectiveSources) ? current : effectiveSources,
    );
    const localSource = effectiveSources.find((s) => s.type === "local_folder")?.value;
    const repoSource = effectiveSources.find((s) => s.type === "repository")?.value;
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
  }, [discovery, doScan, localSourcesKey, onUpdate]);

  const automations = useEngagementAutomations(discovery.id, activePath, scan, connectedSources);

  return {
    ...automations,
    connectedSources,
    localFolderPath,
    setLocalFolderPath,
    repositoryPath,
    setRepositoryPath,
    scan,
    scanningType,
    checkingUpdates,
    updateStatuses,
    deletingSourceKey,
    addAndScanSource,
    removeConnectedSource,
    checkSourceUpdates,
    selectSource,
  };
}
