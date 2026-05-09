"use client";

import { Briefcase, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AuthButton } from "@/components/layout/auth-button";
import { useProject } from "@/stores/project-store";

export function AppHeader() {
  const router = useRouter();
  const { projects, activeProject, setActiveProject } = useProject();
  const visibleProjects = activeProject && !projects.some((project) => project.id === activeProject.id)
    ? [activeProject, ...projects]
    : projects;

  const onProjectChange = (projectId: string) => {
    const project = visibleProjects.find((item) => item.id === projectId) ?? null;
    setActiveProject(project);
  };

  return (
    <header className="flex h-12 items-center gap-3 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 max-w-[320px]">
        <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <select
          aria-label="Select Project"
          className="bg-transparent text-xs font-medium outline-none min-w-[180px] max-w-[220px] truncate"
          value={activeProject?.id ?? ""}
          onChange={(e) => onProjectChange(e.target.value)}
        >
          <option value="" disabled>
            Select Project
          </option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.customer ? `${project.name} (${project.customer})` : project.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("core:start-new-discovery"));
          }
          router.push("/?newDiscovery=1");
        }}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="text-xs">Start New Project</span>
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <AuthButton />
      </div>
    </header>
  );
}
