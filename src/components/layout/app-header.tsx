"use client";

import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AuthButton } from "@/components/layout/auth-button";
import { useProject } from "@/stores/project-store";
import { useDiscovery } from "@/stores/discovery-store";
import { PHASE_CONFIG } from "@/types/core";

export function AppHeader() {
  const { activeProject } = useProject();
  const { activeDiscovery } = useDiscovery();

  return (
    <header className="flex h-12 items-center gap-3 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <div className="h-4 w-px bg-border" aria-hidden />

      {activeProject ? (
        <div className="flex items-center gap-2 min-w-0">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <span className="truncate text-xs font-medium" title={activeProject.name}>
            {activeProject.name}
          </span>
          {activeDiscovery && (
            <Badge variant="secondary" className="text-[9px] shrink-0">
              {PHASE_CONFIG[activeDiscovery.current_phase].label}
            </Badge>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">No project selected</span>
      )}

      <div className="ml-auto flex items-center gap-3">
        <AuthButton />
      </div>
    </header>
  );
}