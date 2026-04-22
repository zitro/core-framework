"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Compass, Lightbulb, Rocket, Home, BookOpen, FolderOpen, FolderGit2, Sparkles, Globe, BookMarked, Briefcase, Building2, ShieldCheck, Cloud, Wand2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { useDiscovery } from "@/stores/discovery-store";
import { PHASE_CONFIG } from "@/types/core";

const PHASE_NAV = [
  {
    phase: "capture",
    step: 1,
    label: "Capture",
    icon: Search,
    href: "/capture",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    phase: "orient",
    step: 2,
    label: "Orient",
    icon: Compass,
    href: "/orient",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    phase: "refine",
    step: 3,
    label: "Refine",
    icon: Lightbulb,
    href: "/refine",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    phase: "execute",
    step: 4,
    label: "Execute",
    icon: Rocket,
    href: "/execute",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { discoveries, activeDiscovery, setActiveDiscovery, loadDiscoveries } = useDiscovery();

  useEffect(() => {
    if (discoveries.length === 0) {
      loadDiscoveries().catch(() => {});
    }
  }, [discoveries.length, loadDiscoveries]);

  const recentDiscoveries = [...discoveries]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              CORE Discovery
            </h2>
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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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

        <SidebarGroup>
          <SidebarGroupLabel>CORE Phases</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PHASE_NAV.map((item) => (
                <SidebarMenuItem key={item.phase}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      pathname.startsWith(item.href)
                        ? `${item.bgColor} ${item.color}`
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {item.step}
                    </span>
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/evidence" />} isActive={pathname === "/evidence"}>
                  <BookOpen className="h-4 w-4 text-orange-500" />
                  <span>All Evidence</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/discoveries" />} isActive={pathname === "/discoveries"}>
                  <FolderOpen className="h-4 w-4 text-indigo-500" />
                  <span>All Discoveries</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/context" />} isActive={pathname === "/context"}>
                  <FolderGit2 className="h-4 w-4 text-teal-500" />
                  <span>Engagement Context</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/narrative" />} isActive={pathname === "/narrative"}>
                  <Sparkles className="h-4 w-4 text-fuchsia-500" />
                  <span>Narrative</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/synthesis" />} isActive={pathname === "/synthesis"}>
                  <Wand2 className="h-4 w-4 text-violet-500" />
                  <span>Synthesis</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/search" />} isActive={pathname === "/search"}>
                  <Globe className="h-4 w-4 text-cyan-500" />
                  <span>Web Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/methodology" />} isActive={pathname === "/methodology"}>
                  <BookMarked className="h-4 w-4 text-amber-500" />
                  <span>Methodology</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>FDE</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/engagements" />} isActive={pathname === "/engagements"}>
                  <Briefcase className="h-4 w-4 text-sky-500" />
                  <span>Engagements</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/company" />} isActive={pathname === "/company"}>
                  <Building2 className="h-4 w-4 text-emerald-500" />
                  <span>Company Research</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/reviews" />} isActive={pathname === "/reviews"}>
                  <ShieldCheck className="h-4 w-4 text-rose-500" />
                  <span>Reviews</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>M365</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/m365" />} isActive={pathname === "/m365"}>
                  <Cloud className="h-4 w-4 text-blue-500" />
                  <span>Microsoft 365</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/grounding" />} isActive={pathname === "/grounding"}>
                  <Wand2 className="h-4 w-4 text-violet-500" />
                  <span>Grounded Answers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {recentDiscoveries.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Recent Discoveries</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recentDiscoveries.map((d) => (
                  <SidebarMenuItem key={d.id}>
                    <SidebarMenuButton
                      isActive={activeDiscovery?.id === d.id}
                      onClick={() => setActiveDiscovery(d)}
                    >
                      <span className="truncate text-xs">{d.name}</span>
                      <Badge variant="outline" className="ml-auto text-[9px] shrink-0">
                        {d.current_phase}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              v1.0.2
            </Badge>
            <span>CORE Framework</span>
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
