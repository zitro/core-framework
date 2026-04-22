"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Discovery, CorePhase } from "@/types/core";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useProject } from "@/stores/project-store";

interface DiscoveryState {
  discoveries: Discovery[];
  activeDiscovery: Discovery | null;
  loading: boolean;
  error: string | null;
}

interface DiscoveryActions {
  loadDiscoveries: () => Promise<void>;
  createDiscovery: (data: Partial<Discovery>) => Promise<Discovery>;
  deleteDiscovery: (id: string) => Promise<void>;
  setActiveDiscovery: (discovery: Discovery | null) => void;
  updatePhase: (id: string, phase: CorePhase) => Promise<void>;
  refreshActive: () => Promise<void>;
}

const DiscoveryContext = createContext<
  (DiscoveryState & DiscoveryActions) | null
>(null);

const ACTIVE_KEY_PREFIX = "core.activeDiscoveryId.";

function readActiveId(projectId: string | null): string | null {
  if (!projectId || typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY_PREFIX + projectId);
}

function writeActiveId(projectId: string | null, discoveryId: string | null) {
  if (!projectId || typeof window === "undefined") return;
  const key = ACTIVE_KEY_PREFIX + projectId;
  if (discoveryId) {
    window.localStorage.setItem(key, discoveryId);
  } else {
    window.localStorage.removeItem(key);
  }
}

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const { activeProject } = useProject();
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [activeDiscovery, setActiveDiscoveryState] = useState<Discovery | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = activeProject?.id ?? null;
  const projectDiscoveryIds = useMemo(
    () => new Set(activeProject?.discovery_ids ?? []),
    [activeProject],
  );

  const scoped = useMemo(() => {
    if (!projectId) return discoveries;
    if (projectDiscoveryIds.size === 0) return [];
    return discoveries.filter((d) => projectDiscoveryIds.has(d.id));
  }, [discoveries, projectDiscoveryIds, projectId]);

  const loadDiscoveries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.discoveries.list();
      setDiscoveries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const setActiveDiscovery = useCallback(
    (discovery: Discovery | null) => {
      setActiveDiscoveryState(discovery);
      writeActiveId(projectId, discovery?.id ?? null);
    },
    [projectId],
  );

  // Auto-pick an active discovery whenever the project or its scoped list changes.
  useEffect(() => {
    if (!projectId) {
      setActiveDiscoveryState(null);
      return;
    }
    if (scoped.length === 0) {
      setActiveDiscoveryState(null);
      return;
    }
    const savedId = readActiveId(projectId);
    const fromSaved = savedId
      ? scoped.find((d) => d.id === savedId)
      : undefined;
    const newest = [...scoped].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
    const next = fromSaved ?? newest ?? null;
    setActiveDiscoveryState(next);
    writeActiveId(projectId, next?.id ?? null);
  }, [projectId, scoped]);

  // Initial load on mount.
  useEffect(() => {
    loadDiscoveries().catch(() => {});
  }, [loadDiscoveries]);

  const createDiscovery = useCallback(
    async (data: Partial<Discovery>) => {
      setLoading(true);
      setError(null);
      try {
        const created = await api.discoveries.create(data);
        setDiscoveries((prev) => [...prev, created]);
        setActiveDiscoveryState(created);
        writeActiveId(projectId, created.id);
        toast.success(`Discovery "${created.name}" created`);
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  const deleteDiscovery = useCallback(async (id: string) => {
    try {
      await api.discoveries.delete(id);
      setDiscoveries((prev) => prev.filter((d) => d.id !== id));
      setActiveDiscoveryState((prev) => (prev?.id === id ? null : prev));
      toast.success("Discovery deleted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg);
      throw e;
    }
  }, []);

  const updatePhase = useCallback(async (id: string, phase: CorePhase) => {
    const updated = await api.discoveries.update(id, { current_phase: phase });
    setDiscoveries((prev) => prev.map((d) => (d.id === id ? updated : d)));
    setActiveDiscoveryState((prev) => (prev?.id === id ? updated : prev));
  }, []);

  const refreshActive = useCallback(async () => {
    const id = activeDiscovery?.id;
    if (!id) return;
    const updated = await api.discoveries.get(id);
    setDiscoveries((prev) => prev.map((d) => (d.id === id ? updated : d)));
    setActiveDiscoveryState(updated);
  }, [activeDiscovery?.id]);

  return (
    <DiscoveryContext.Provider
      value={{
        discoveries: scoped,
        activeDiscovery,
        loading,
        error,
        loadDiscoveries,
        createDiscovery,
        deleteDiscovery,
        setActiveDiscovery,
        updatePhase,
        refreshActive,
      }}
    >
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery() {
  const ctx = useContext(DiscoveryContext);
  if (!ctx)
    throw new Error("useDiscovery must be used within DiscoveryProvider");
  return ctx;
}