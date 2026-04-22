"use client";

import Link from "next/link";
import { Briefcase, Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useProject } from "@/stores/project-store";

/** Sidebar header dropdown for switching the active project (engagement). */
export function ProjectSwitcher() {
  const { projects, activeProject, setActiveProject, loading } = useProject();

  const label = activeProject?.name ?? (loading ? "Loading projects…" : "No project selected");
  const sub = activeProject?.customer || activeProject?.slug || "Select a project";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto w-full justify-between gap-2 px-2 py-2 text-left"
          />
        }
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Briefcase className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold leading-tight">{label}</div>
            <div className="truncate text-[10px] text-muted-foreground">{sub}</div>
          </div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Projects
        </DropdownMenuLabel>
        {projects.length === 0 ? (
          <DropdownMenuItem disabled>
            <span className="text-xs text-muted-foreground">
              {loading ? "Loading…" : "No projects yet"}
            </span>
          </DropdownMenuItem>
        ) : (
          projects.map((p) => {
            const isActive = activeProject?.id === p.id;
            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setActiveProject(p)}
                className="gap-2"
              >
                <Check
                  className={`h-3.5 w-3.5 ${isActive ? "opacity-100" : "opacity-0"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{p.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {p.customer || p.slug}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/engagements" />}
          className="gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">Manage projects</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
