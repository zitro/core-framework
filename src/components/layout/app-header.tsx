"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AuthButton } from "@/components/layout/auth-button";
import { ProjectSwitcher } from "@/components/layout/project-switcher";

export function AppHeader() {
  const router = useRouter();

  return (
    <header className="flex h-12 items-center gap-3 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <div className="h-4 w-px bg-border" />

      {/* Replaces the native <select> that the audit called out as
          the OS-styled outlier on the most-touched control in the
          app. ProjectSwitcher is a real styled dropdown with
          truncation, role labels, and keyboard nav. */}
      <div className="max-w-[280px]">
        <ProjectSwitcher />
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
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true }),
              );
            }
          }}
          className="hidden h-7 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground hover:text-foreground sm:flex"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span>Search…</span>
          <kbd className="ml-1 inline-flex items-center gap-0.5 rounded border bg-muted px-1 py-0.5 text-[10px]">
            <span>⌘</span>K
          </kbd>
        </button>
        <AuthButton />
      </div>
    </header>
  );
}
