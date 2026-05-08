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

  const loadDiscoveries = useCallback(async (projectId?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const discoveries = await api.discoveries.list(projectId);
      setState((s) => ({ ...s, discoveries, loading: false }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load",
      }));
    }
  }, []);

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
  }, []);

  const setActiveDiscovery = useCallback((discovery: Discovery | null) => {
    setState((s) => ({ ...s, activeDiscovery: discovery }));
  }, []);

  const updatePhase = useCallback(
    async (id: string, phase: CorePhase) => {
      const updated = await api.discoveries.update(id, {
        current_phase: phase,
      });
      setState((s) => ({
        ...s,
        activeDiscovery:
          s.activeDiscovery?.id === id ? updated : s.activeDiscovery,
        discoveries: s.discoveries.map((d) => (d.id === id ? updated : d)),
      }));
    },
    []
  );

  const refreshActive = useCallback(async () => {
    const activeId = state.activeDiscovery?.id;
    if (!activeId) return;
    const updated = await api.discoveries.get(activeId);
    setState((s) => ({ ...s, activeDiscovery: updated }));
  }, [state.activeDiscovery?.id]);

  const bootstrapForProject = useCallback(
    async (projectId: string, projectName: string) => {
      setState((s) => ({ ...s, loading: true }));
      try {
        // Only fetch discoveries belonging to this project
        const mine = await api.discoveries.list(projectId);
        if (mine.length > 0) {
          const latest = [...mine].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0];
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
          setState((s) => ({
            ...s,
            discoveries: [created],
            activeDiscovery: created,
            loading: false,
          }));
        }
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    []
  );

  return (
    <DiscoveryContext.Provider
      value={{
        ...state,
        loadDiscoveries,
        createDiscovery,
        setActiveDiscovery,
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
