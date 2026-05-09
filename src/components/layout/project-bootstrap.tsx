"use client";

import { useEffect, useRef } from "react";
import { useProject } from "@/stores/project-store";
import { useDiscovery } from "@/stores/discovery-store";

/**
 * Bootstraps project and discovery state on initial app load.
 *
 * activeProject is restored by ProjectProvider shortly after hydration,
 * so no route-change tracking is needed here. This component only:
 *   1. Triggers a background API refresh on mount (one time)
 *   2. Falls back to the most recent project if nothing was cached
 *   3. Auto-bootstraps the discovery when activeProject is known
 */
export function ProjectBootstrap() {
  const { projects, activeProject, setActiveProject, loadProjects } = useProject();
  const { bootstrapForProject } = useDiscovery();
  const lastProjectId = useRef<string | null>(null);
  const bootstrappingProjectId = useRef<string | null>(null);
  const initialized = useRef(false);

  // Background refresh: fetch latest project list once on mount.
  // The UI already shows the cached activeProject immediately — this
  // silently updates the list and resolves any stale cached data.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadProjects().catch(() => {});
  }, [loadProjects]);

  // Fallback: if no project was cached (first-ever load), pick the most recent.
  useEffect(() => {
    if (activeProject || projects.length === 0) return;
    const fallback = [...projects].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
    if (fallback) setActiveProject(fallback);
  }, [activeProject, projects, setActiveProject]);

  // Bootstrap the discovery whenever the active project changes.
  useEffect(() => {
    if (!activeProject) return;
    if (activeProject.id === lastProjectId.current) return;
    if (activeProject.id === bootstrappingProjectId.current) return;

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const projectId = activeProject.id;
    const projectName = activeProject.name;

    const runBootstrap = async (attempt = 0) => {
      bootstrappingProjectId.current = projectId;
      try {
        await bootstrapForProject(projectId, projectName);
        if (cancelled) return;
        // Mark success only after bootstrap completes to avoid locking
        // this project into a permanently "initialized" state on failures.
        lastProjectId.current = projectId;
      } catch {
        if (cancelled) return;
        if (attempt < 2) {
          const delayMs = 1500 * (attempt + 1);
          retryTimeout = setTimeout(() => {
            void runBootstrap(attempt + 1);
          }, delayMs);
          return;
        }
      } finally {
        if (!cancelled) {
          bootstrappingProjectId.current = null;
        }
      }
    };

    void runBootstrap();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (bootstrappingProjectId.current === projectId) {
        bootstrappingProjectId.current = null;
      }
    };
  }, [activeProject, bootstrapForProject]);

  return null;
}
