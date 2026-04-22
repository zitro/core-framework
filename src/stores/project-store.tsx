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
  activeProject: Project | null;
  loading: boolean;
  error: string | null;
}

interface ProjectActions {
  loadProjects: () => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "core.activeProjectId";

const ProjectContext = createContext<(ProjectState & ProjectActions) | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProjectState>({
    projects: [],
    activeProject: null,
    loading: false,
    error: null,
  });

  const persistActive = useCallback((project: Project | null) => {
    setActiveProjectId(project?.id ?? null);
    if (typeof window === "undefined") return;
    if (project?.id) {
      window.localStorage.setItem(STORAGE_KEY, project.id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setActiveProject = useCallback(
    (project: Project | null) => {
      setState((s) => ({ ...s, activeProject: project }));
      persistActive(project);
    },
    [persistActive],
  );

  const loadProjects = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const projects = await engagementsApi.list();
      let active: Project | null = null;
      if (typeof window !== "undefined") {
        const savedId = window.localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          active = projects.find((p) => p.id === savedId) ?? null;
        }
      }
      if (!active && projects.length === 1) {
        active = projects[0];
      }
      persistActive(active);
      setState({ projects, activeProject: active, loading: false, error: null });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load projects",
      }));
    }
  }, [persistActive]);

  const refresh = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadProjects().catch(() => {});
  }, [loadProjects]);

  return (
    <ProjectContext.Provider
      value={{ ...state, loadProjects, setActiveProject, refresh }}
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
