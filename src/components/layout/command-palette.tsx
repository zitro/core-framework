"use client";

/**
 * Global Cmd+K command palette (v2.0).
 *
 * Lives at the layout level so every page gets the same shortcut. Uses
 * the existing Dialog + Input primitives â€” no new dependency.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Briefcase,
  Building2,
  Cloud,
  Compass,
  FileStack,
  FolderGit2,
  Globe,
  Home,
  type LucideIcon,
  MessageSquare,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProject } from "@/stores/project-store";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const router = useRouter();
  const { activeProject } = useProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hasRepo = !!activeProject?.repo_path;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const commands = useMemo<Command[]>(() => {
    const nav = (path: string) => () => {
      setOpen(false);
      router.push(path);
    };
    const items: Command[] = [
      { id: "go.dashboard", label: "Dashboard", icon: Home, run: nav("/") },
      { id: "go.artifacts", label: "Artifacts", icon: FileStack, run: nav("/artifacts") },
      { id: "go.synthesis", label: "Synthesis", icon: Wand2, run: nav("/synthesis") },
      { id: "go.methodology", label: "Methodology", icon: BookMarked, run: nav("/methodology") },
      { id: "go.context", label: "Engagement Context", icon: FolderGit2, run: nav("/context") },
      { id: "go.connectors", label: "Connectors", icon: Plug, run: nav("/connectors") },
      { id: "go.company", label: "Company Research", icon: Building2, run: nav("/company") },
      { id: "go.search", label: "Web Search", icon: Globe, run: nav("/search") },
      { id: "go.narrative", label: "Narrative", icon: Sparkles, run: nav("/narrative") },
      { id: "go.evidence", label: "Evidence", icon: Compass, run: nav("/evidence") },
      { id: "go.grounding", label: "Grounded Answers", icon: MessageSquare, run: nav("/grounding") },
      { id: "go.engagements", label: "Engagements", icon: Briefcase, run: nav("/engagements") },
      { id: "go.reviews", label: "Reviews", icon: ShieldCheck, run: nav("/reviews") },
      { id: "go.m365", label: "Microsoft 365", icon: Cloud, run: nav("/m365") },
    ];
    if (hasRepo) {
      items.splice(2, 0, {
        id: "go.vertex",
        label: "Vertex Repo",
        hint: "v2.0",
        icon: FolderGit2,
        run: nav("/vertex"),
      });
    }
    return items;
  }, [hasRepo, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      [c.label, c.hint ?? "", ...(c.keywords ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, commands]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-xl overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 size-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump toâ€¦  (Cmd/Ctrl+K)"
            autoFocus
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            aria-label="Search commands"
          />
        </div>
        <ul role="listbox" className="max-h-80 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches
            </li>
          ) : (
            filtered.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={c.run}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    <span className="flex-1">{c.label}</span>
                    {c.hint && (
                      <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {c.hint}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>Cmd/Ctrl+K to toggle</span>
          <span>Esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
