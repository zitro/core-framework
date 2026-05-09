"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Discovery, CorePhase } from "@/types/core";
import { api } from "@/lib/api";
import { toast } from "sonner";

const discoveryStorageKey = (projectId: string) => `core.activeDiscoveryId:${projectId}`;
const discoveryCacheKey = (projectId: string) => `core.activeDiscoveryCache:${projectId}`;

interface DiscoveryState {
  discoveries: Discovery[];
  activeDiscovery: Discovery | null;
  loading: boolean;
  error: string | null;
}

interface DiscoveryActions {
  loadDiscoveries: (projectId?: string) => Promise<void>;
  createDiscovery: (data: Partial<Discovery>) => Promise<Discovery>;
  setActiveDiscovery: (discovery: Discovery | null) => void;
  updateDiscovery: (id: string, data: Partial<Discovery>) => Promise<Discovery>;
  deleteDiscovery: (id: string) => Promise<void>;
  updatePhase: (id: string, phase: CorePhase) => Promise<void>;
  refreshActive: () => Promise<void>;
  /** Auto-load or create the single discovery for a project. */
  bootstrapForProject: (projectId: string, projectName: string) => Promise<void>;
}

const DiscoveryContext = createContext<
  (DiscoveryState & DiscoveryActions) | null
>(null);

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiscoveryState>({
    discoveries: [],
    activeDiscovery: null,
    loading: false,
    error: null,
  });

  const persistActiveDiscovery = useCallback((projectId: string | undefined, discovery: Discovery | null) => {
    if (typeof window === "undefined" || !projectId) return;
    if (discovery?.id) {
      window.localStorage.setItem(discoveryStorageKey(projectId), discovery.id);
      window.localStorage.setItem(discoveryCacheKey(projectId), JSON.stringify(discovery));
    } else {
      window.localStorage.removeItem(discoveryStorageKey(projectId));
      window.localStorage.removeItem(discoveryCacheKey(projectId));
    }
  }, []);

  const readActiveDiscoveryId = useCallback((projectId: string | undefined) => {
    if (typeof window === "undefined" || !projectId) return null;
    return window.localStorage.getItem(discoveryStorageKey(projectId));
  }, []);

  const readActiveDiscoveryCache = useCallback((projectId: string | undefined) => {
    if (typeof window === "undefined" || !projectId) return null;
    const raw = window.localStorage.getItem(discoveryCacheKey(projectId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Discovery;
    } catch {
      return null;
    }
  }, []);

  const loadDiscoveries = useCallback(async (projectId?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const discoveries = await api.discoveries.list(projectId);
      const savedDiscoveryId = readActiveDiscoveryId(projectId);
      setState((s) => {
        const active =
          discoveries.find((item) => item.id === savedDiscoveryId) ??
          (projectId && s.activeDiscovery?.project_id === projectId ? s.activeDiscovery : null) ??
          discoveries[0] ??
          null;
        persistActiveDiscovery(projectId, active);
        return { ...s, discoveries, activeDiscovery: active, loading: false };
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load",
      }));
    }
  }, [persistActiveDiscovery, readActiveDiscoveryId]);

  const createDiscovery = useCallback(async (data: Partial<Discovery>) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const created = await api.discoveries.create(data);
      setState((s) => ({
        ...s,
        discoveries: [...s.discoveries, created],
        activeDiscovery: created,
        loading: false,
      }));
      persistActiveDiscovery(created.project_id, created);
      toast.success(`Discovery "${created.name}" created`);
      return created;
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to create",
      }));
      throw e;
    }
  }, [persistActiveDiscovery]);

  const setActiveDiscovery = useCallback((discovery: Discovery | null) => {
    persistActiveDiscovery(discovery?.project_id, discovery);
    setState((s) => ({ ...s, activeDiscovery: discovery }));
  }, [persistActiveDiscovery]);

  const updateDiscovery = useCallback(async (id: string, data: Partial<Discovery>) => {
    const updated = await api.discoveries.update(id, data);
    persistActiveDiscovery(updated.project_id, updated);
    setState((s) => ({
      ...s,
      activeDiscovery: s.activeDiscovery?.id === id ? updated : s.activeDiscovery,
      discoveries: s.discoveries.map((d) => (d.id === id ? updated : d)),
    }));
    return updated;
  }, [persistActiveDiscovery]);

  const deleteDiscovery = useCallback(async (id: string) => {
    await api.discoveries.delete(id);
    setState((s) => {
      const remaining = s.discoveries.filter((d) => d.id !== id);
      const nextActive = s.activeDiscovery?.id === id ? remaining[0] ?? null : s.activeDiscovery;
      persistActiveDiscovery(nextActive?.project_id, nextActive);
      return {
        ...s,
        discoveries: remaining,
        activeDiscovery: nextActive,
      };
    });
  }, [persistActiveDiscovery]);

  const updatePhase = useCallback(
    async (id: string, phase: CorePhase) => {
      const updated = await api.discoveries.update(id, {
        current_phase: phase,
      });
      persistActiveDiscovery(updated.project_id, updated);
      setState((s) => ({
        ...s,
        activeDiscovery:
          s.activeDiscovery?.id === id ? updated : s.activeDiscovery,
        discoveries: s.discoveries.map((d) => (d.id === id ? updated : d)),
      }));
    },
    [persistActiveDiscovery]
  );

  const refreshActive = useCallback(async () => {
    const activeId = state.activeDiscovery?.id;
    if (!activeId) return;
    const updated = await api.discoveries.get(activeId);
    persistActiveDiscovery(updated.project_id, updated);
    setState((s) => ({ ...s, activeDiscovery: updated }));
  }, [persistActiveDiscovery, state.activeDiscovery?.id]);

  const bootstrapForProject = useCallback(
    async (projectId: string, projectName: string) => {
      const cached = readActiveDiscoveryCache(projectId);
      setState((s) => ({
        ...s,
        loading: true,
        activeDiscovery: cached ?? s.activeDiscovery,
        discoveries:
          cached && s.discoveries.length === 0
            ? [cached]
            : s.discoveries,
      }));
      try {
        // Only fetch discoveries belonging to this project
        const mine = await api.discoveries.list(projectId);
        if (mine.length > 0) {
          const savedDiscoveryId = readActiveDiscoveryId(projectId);
          const latest =
            mine.find((item) => item.id === savedDiscoveryId) ??
            [...mine].sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )[0];
          persistActiveDiscovery(projectId, latest);
          setState((s) => ({
            ...s,
            discoveries: mine,
            activeDiscovery: latest,
            loading: false,
          }));
        } else {
          // Create the single discovery for this project
          const created = await api.discoveries.create({
            name: projectName,
            description: "",
            current_phase: "capture",
            project_id: projectId,
          });
          persistActiveDiscovery(projectId, created);
          setState((s) => ({
            ...s,
            discoveries: [created],
            activeDiscovery: created,
            loading: false,
          }));
        }
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to bootstrap discovery",
        }));
        throw e;
      }
    },
    [persistActiveDiscovery, readActiveDiscoveryCache, readActiveDiscoveryId]
  );

  return (
    <DiscoveryContext.Provider
      value={{
        ...state,
        loadDiscoveries,
        createDiscovery,
        setActiveDiscovery,
        updateDiscovery,
        deleteDiscovery,
        updatePhase,
        refreshActive,
        bootstrapForProject,
      }}
    >
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery() {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) throw new Error("useDiscovery must be used within DiscoveryProvider");
  return ctx;
}
