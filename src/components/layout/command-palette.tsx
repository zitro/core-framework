"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import {
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  Cloud,
  Compass,
  FolderGit2,
  Globe,
  Home,
  Lightbulb,
  Moon,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { useDiscovery } from "@/stores/discovery-store";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Search;
  keywords?: string[];
};

const PHASES: NavItem[] = [
  { label: "Capture", href: "/capture", icon: Search, keywords: ["phase", "1"] },
  { label: "Orchestrate", href: "/orchestrate", icon: Compass, keywords: ["phase", "2"] },
  { label: "Refine", href: "/refine", icon: Lightbulb, keywords: ["phase", "3"] },
  { label: "Execute", href: "/execute", icon: Rocket, keywords: ["phase", "4"] },
];

const TOOLS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "All Evidence", href: "/evidence", icon: BookOpen },
  { label: "Engagement Context", href: "/context", icon: FolderGit2 },
  { label: "Web Search", href: "/search", icon: Globe },
  { label: "Methodology", href: "/methodology", icon: BookMarked },
  { label: "Settings", href: "/settings", icon: Settings, keywords: ["sources", "config"] },
];

const FDE: NavItem[] = [
  { label: "Engagements", href: "/engagements", icon: Briefcase },
  { label: "Company Research", href: "/company", icon: Building2 },
  { label: "Reviews", href: "/reviews", icon: ShieldCheck },
  { label: "Microsoft 365", href: "/m365", icon: Cloud, keywords: ["m365", "microsoft"] },
  { label: "Grounded Answers", href: "/grounding", icon: Wand2 },
];

export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { discoveries, setActiveDiscovery } = useDiscovery();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [router, close],
  );

  const startNewDiscovery = useCallback(() => {
    close();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("core:start-new-discovery"));
    }
    router.push("/?newDiscovery=1");
  }, [router, close]);

  const toggleTheme = useCallback(() => {
    close();
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme, close]);

  const discoveryItems = useMemo(
    () =>
      discoveries
        .slice()
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
        .slice(0, 8),
    [discoveries],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-[20%] left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2",
            "rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none",
            "sm:max-w-lg",
            "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
          aria-label="Command palette"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command
            label="Command palette"
            className="overflow-hidden rounded-xl"
            loop
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <Command.Input
                placeholder="Type a phase, page, discovery, or action…"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
                ESC
              </kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matches.
              </Command.Empty>

              <Command.Group
                heading="Phases"
                className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {PHASES.map((item) => (
                  <PaletteItem
                    key={item.href}
                    value={`phase ${item.label} ${(item.keywords ?? []).join(" ")}`}
                    onSelect={() => navigate(item.href)}
                    icon={item.icon}
                    label={item.label}
                  />
                ))}
              </Command.Group>

              <Command.Group
                heading="Tools"
                className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {TOOLS.map((item) => (
                  <PaletteItem
                    key={item.href}
                    value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                    onSelect={() => navigate(item.href)}
                    icon={item.icon}
                    label={item.label}
                  />
                ))}
              </Command.Group>

              <Command.Group
                heading="FDE"
                className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {FDE.map((item) => (
                  <PaletteItem
                    key={item.href}
                    value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                    onSelect={() => navigate(item.href)}
                    icon={item.icon}
                    label={item.label}
                  />
                ))}
              </Command.Group>

              {discoveryItems.length > 0 && (
                <Command.Group
                  heading="Discoveries"
                  className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground [&_[cmdk-group-items]]:mt-1"
                >
                  {discoveryItems.map((d) => (
                    <PaletteItem
                      key={d.id}
                      value={`discovery ${d.name}`}
                      onSelect={() => {
                        setActiveDiscovery(d);
                        navigate("/capture");
                      }}
                      icon={Sparkles}
                      label={d.name || "(untitled)"}
                      hint={d.current_phase}
                    />
                  ))}
                </Command.Group>
              )}

              <Command.Group
                heading="Actions"
                className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                <PaletteItem
                  value="action new discovery start"
                  onSelect={startNewDiscovery}
                  icon={Plus}
                  label="Start new discovery"
                />
                <PaletteItem
                  value="action toggle theme dark light mode"
                  onSelect={toggleTheme}
                  icon={theme === "dark" ? Sun : Moon}
                  label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                />
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteItem({
  value,
  onSelect,
  icon: Icon,
  label,
  hint,
}: {
  value: string;
  onSelect: () => void;
  icon: typeof Search;
  label: string;
  hint?: string | null;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        "data-[selected=true]:bg-muted aria-selected:bg-muted",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {hint}
        </span>
      )}
    </Command.Item>
  );
}
