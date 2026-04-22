"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import pkg from "../../../package.json";
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
  type LucideIcon,
  MessageSquare,
  Plug,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProjectSwitcher } from "@/components/layout/project-switcher";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface PhaseGroup {
  step: number;
  phase: "capture" | "orient" | "refine" | "execute";
  label: string;
  icon: LucideIcon;
  accent: string;
  items: NavItem[];
}

const PHASE_GROUPS: PhaseGroup[] = [
  {
    step: 1,
    phase: "capture",
    label: "Capture",
    icon: Search,
    accent: "text-blue-500",
    items: [
      { label: "Engagement Context", href: "/context", icon: FolderGit2 },
      { label: "Connectors", href: "/connectors", icon: Plug },
      { label: "Company Research", href: "/company", icon: Building2 },
      { label: "Web Search", href: "/search", icon: Globe },
    ],
  },
  {
    step: 2,
    phase: "orient",
    label: "Orient",
    icon: Compass,
    accent: "text-amber-500",
    items: [
      { label: "Synthesis", href: "/synthesis", icon: Wand2 },
      { label: "Methodology", href: "/methodology", icon: BookMarked },
    ],
  },
  {
    step: 3,
    phase: "refine",
    label: "Refine",
    icon: Lightbulb,
    accent: "text-emerald-500",
    items: [
      { label: "Narrative", href: "/narrative", icon: Sparkles },
      { label: "Evidence", href: "/evidence", icon: BookOpen },
      { label: "Grounded Answers", href: "/grounding", icon: MessageSquare },
    ],
  },
  {
    step: 4,
    phase: "execute",
    label: "Execute",
    icon: Rocket,
    accent: "text-violet-500",
    items: [
      { label: "Engagements", href: "/engagements", icon: Briefcase },
      { label: "Reviews", href: "/reviews", icon: ShieldCheck },
      { label: "Microsoft 365", href: "/m365", icon: Cloud },
    ],
  },
];

const FRAMEWORK_VERSION = pkg.version;

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="CORE home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">CORE</h2>
            <p className="text-[10px] text-muted-foreground">
              Capture · Orient · Refine · Execute
            </p>
          </div>
        </Link>
        <div className="mt-2">
          <ProjectSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/" />} isActive={pathname === "/"}>
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {PHASE_GROUPS.map((group) => {
          const PhaseIcon = group.icon;
          return (
            <SidebarGroup key={group.phase}>
              <SidebarGroupLabel className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold ${group.accent}`}
                  aria-hidden
                >
                  {group.step}
                </span>
                <PhaseIcon className={`h-3.5 w-3.5 ${group.accent}`} aria-hidden />
                <span className="uppercase tracking-wider">{group.label}</span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isActive(item.href)}
                        >
                          <ItemIcon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              v{FRAMEWORK_VERSION}
            </Badge>
            <span>CORE Framework</span>
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}