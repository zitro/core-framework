"use client";

import { useEffect } from "react";
import { ChevronsUpDown, Plus, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDiscovery } from "@/stores/discovery-store";
import { PHASE_CONFIG } from "@/types/core";

export function AppHeader() {
  const router = useRouter();
  const { discoveries, activeDiscovery, setActiveDiscovery, loadDiscoveries } = useDiscovery();

  useEffect(() => {
    if (discoveries.length === 0) {
      loadDiscoveries().catch(() => {});
    }
  }, [discoveries.length, loadDiscoveries]);

  return (
    <header className="flex h-12 items-center gap-3 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <div className="h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2 max-w-[280px]" />}>
            {activeDiscovery ? (
              <>
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs font-medium">
                  {activeDiscovery.name}
                </span>
                <Badge variant="secondary" className="text-[9px] shrink-0 ml-auto">
                  {PHASE_CONFIG[activeDiscovery.current_phase].label}
                </Badge>
              </>
            ) : (
              <>
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Select Discovery</span>
              </>
            )}
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
              Switch Discovery
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {discoveries.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No discoveries yet
              </div>
            ) : (
              discoveries.map((d) => (
                <DropdownMenuItem
                  key={d.id}
                  onClick={() => setActiveDiscovery(d)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span className="truncate flex-1 text-xs">{d.name}</span>
                  <Badge
                    variant={activeDiscovery?.id === d.id ? "default" : "outline"}
                    className="text-[9px] shrink-0"
                  >
                    {PHASE_CONFIG[d.current_phase].label}
                  </Badge>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push("/")}
            className="gap-2 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs">New Discovery</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
