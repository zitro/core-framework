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

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiscoveryState>({
    discoveries: [],
    activeDiscovery: null,
    loading: false,
    error: null,
  });

  const loadDiscoveries = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const discoveries = await api.discoveries.list();
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

  const deleteDiscovery = useCallback(async (id: string) => {
    try {
      await api.discoveries.delete(id);
      setState((s) => ({
        ...s,
        discoveries: s.discoveries.filter((d) => d.id !== id),
        activeDiscovery: s.activeDiscovery?.id === id ? null : s.activeDiscovery,
      }));
      toast.success("Discovery deleted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg);
      throw e;
    }
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

  return (
    <DiscoveryContext.Provider
      value={{
        ...state,
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
  if (!ctx) throw new Error("useDiscovery must be used within DiscoveryProvider");
  return ctx;
}
