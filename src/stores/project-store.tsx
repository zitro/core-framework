"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Project } from "@/types/fde";
import { engagementsApi } from "@/lib/api-fde";
import { setActiveProjectId } from "@/lib/http";

interface ProjectState {
  projects: Project[];
  selectedCustomer: string | null;
  activeProject: Project | null;
  loading: boolean;
  error: string | null;
}

interface ProjectActions {
  loadProjects: () => Promise<void>;
  setSelectedCustomer: (customer: string | null) => void;
  setActiveProject: (project: Project | null) => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY_PROJECT = "core.activeProjectId";
const STORAGE_KEY_CUSTOMER = "core.selectedCustomer";
const STORAGE_KEY_PROJECT_CACHE = "core.activeProjectCache";

const ProjectContext = createContext<(ProjectState & ProjectActions) | null>(null);

/**
 * Synchronously reads the full Project object from localStorage cache.
 * This allows activeProject to be populated BEFORE any async API call,
 * preventing the "Select Project" flash on page load and navigation.
 */
function getInitialStateFromStorage(): { activeProject: Project | null; savedCustomer: string | null } {
  if (typeof window === "undefined") {
    return { activeProject: null, savedCustomer: null };
  }
  const savedProjectId = window.localStorage.getItem(STORAGE_KEY_PROJECT);
  const savedCustomer = window.localStorage.getItem(STORAGE_KEY_CUSTOMER);
  let activeProject: Project | null = null;
  if (savedProjectId) {
    const raw = window.localStorage.getItem(STORAGE_KEY_PROJECT_CACHE);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as Project;
        if (cached.id === savedProjectId) {
          activeProject = cached;
        }
      } catch { /* malformed cache — ignore, loadProjects will fix it */ }
    }
  }
  return { activeProject, savedCustomer };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  // Always initialize with null — matches the server render, no hydration mismatch.
  // Cache restore happens in the mount effect below (client-only).
  const [state, setState] = useState<ProjectState>({
    projects: [],
    selectedCustomer: null,
    activeProject: null,
    loading: false,
    error: null,
  });

  const persistSelectedCustomer = useCallback((customer: string | null) => {
    if (typeof window === "undefined") return;
    if (customer) {
      window.localStorage.setItem(STORAGE_KEY_CUSTOMER, customer);
    } else {
      window.localStorage.removeItem(STORAGE_KEY_CUSTOMER);
    }
  }, []);

  const persistActive = useCallback((project: Project | null) => {
    setActiveProjectId(project?.id ?? null);
    if (typeof window === "undefined") return;
    if (project?.id) {
      window.localStorage.setItem(STORAGE_KEY_PROJECT, project.id);
      // Cache the full object so it can be restored synchronously on next load
      window.localStorage.setItem(STORAGE_KEY_PROJECT_CACHE, JSON.stringify(project));
    } else {
      window.localStorage.removeItem(STORAGE_KEY_PROJECT);
      window.localStorage.removeItem(STORAGE_KEY_PROJECT_CACHE);
    }
  }, []);

  const setSelectedCustomer = useCallback(
    (customer: string | null) => {
      setState((s) => ({ ...s, selectedCustomer: customer, activeProject: null }));
      persistSelectedCustomer(customer);
      persistActive(null);
    },
    [persistActive, persistSelectedCustomer],
  );

  const setActiveProject = useCallback(
    (project: Project | null) => {
      setState((s) => ({
        ...s,
        activeProject: project,
        selectedCustomer: project?.customer?.trim() || s.selectedCustomer,
      }));
      persistSelectedCustomer(project?.customer?.trim() || null);
      persistActive(project);
    },
    [persistActive, persistSelectedCustomer],
  );

  const loadProjects = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const projects = await engagementsApi.list();
      let active: Project | null = null;
      let selectedCustomer: string | null = null;
      const availableCustomers = Array.from(
        new Set(projects.map((p) => (p.customer || "").trim()).filter((c) => c.length > 0)),
      );

      let savedCustomer: string | null = null;
      let savedProjectId: string | null = null;
      if (typeof window !== "undefined") {
        savedCustomer = window.localStorage.getItem(STORAGE_KEY_CUSTOMER);
        savedProjectId = window.localStorage.getItem(STORAGE_KEY_PROJECT);
      }

      if (savedCustomer && availableCustomers.includes(savedCustomer)) {
        selectedCustomer = savedCustomer;
      }

      // In one-customer deployments, customer context is fixed for the instance.
      if (!selectedCustomer && availableCustomers.length > 0) {
        selectedCustomer = availableCustomers[0];
      }

      if (!selectedCustomer && projects.length > 0) {
        selectedCustomer = (projects[0].customer || "").trim() || null;
      }

      if (savedProjectId) {
        const savedProject = projects.find((p) => p.id === savedProjectId) ?? null;
        if (savedProject) {
          active = savedProject;
          selectedCustomer = (savedProject.customer || "").trim() || selectedCustomer;
        }
      }

      if (selectedCustomer && !active) {
        const projectsForCustomer = projects.filter(
          (p) => (p.customer || "").trim() === selectedCustomer,
        );
        if (projectsForCustomer.length > 0) {
          active = [...projectsForCustomer].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          )[0];
        }
      }

      if (!active && projects.length > 0) {
        active = [...projects].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )[0];
        selectedCustomer = (active.customer || "").trim() || selectedCustomer;
      }

      persistSelectedCustomer(selectedCustomer);
      persistActive(active);
      setState({
        projects,
        selectedCustomer,
        activeProject: active,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load projects",
      }));
    }
  }, [persistActive, persistSelectedCustomer]);

  const refresh = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  // Single mount effect: runs once on the client after hydration is complete.
  // 1. Immediately restores the cached project from localStorage (no API call needed).
  // 2. Fires loadProjects() in the background to validate/refresh from the API.
  // 3. If the API call fails (backend not ready on fresh start), retries once after 3s.
  useEffect(() => {
    // Restore cache immediately so the UI shows the project without waiting for the API.
    const { activeProject: cached, savedCustomer: cachedCustomer } = getInitialStateFromStorage();
    if (cached) {
      setState((s) => ({
        ...s,
        activeProject: cached,
        selectedCustomer: cachedCustomer ?? cached.customer?.trim() ?? s.selectedCustomer,
      }));
      setActiveProjectId(cached.id);
    }

    // Background API refresh with one retry for slow backend startup.
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    loadProjects().catch(() => {
      retryTimeout = setTimeout(() => {
        loadProjects().catch(() => {});
      }, 3000);
    });

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  // loadProjects is a stable useCallback — ESLint disable is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProjectContext.Provider
      value={{ ...state, loadProjects, setSelectedCustomer, setActiveProject, refresh }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
