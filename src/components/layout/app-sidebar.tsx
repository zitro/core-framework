"use client";

import packageJson from "../../../package.json";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Compass, Lightbulb, Rocket, Home, BookOpen, FolderGit2, Sparkles, Globe, BookMarked, Building2, Briefcase, ShieldCheck, Cloud, Wand2, Settings } from "lucide-react";
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
import { useProject } from "@/stores/project-store";

const APP_VERSION = packageJson.version;

const PHASE_NAV = [
  {
    phase: "capture",
    step: 1,
    label: "Capture",
    icon: Search,
    href: "/capture",
    activeClass: "bg-phase-capture/15 text-phase-capture",
  },
  {
    phase: "orchestrate",
    step: 2,
    label: "Orchestrate",
    icon: Compass,
    href: "/orchestrate",
    activeClass: "bg-phase-orchestrate/15 text-phase-orchestrate",
  },
  {
    phase: "refine",
    step: 3,
    label: "Refine",
    icon: Lightbulb,
    href: "/refine",
    activeClass: "bg-phase-refine/15 text-phase-refine",
  },
  {
    phase: "execute",
    step: 4,
    label: "Execute",
    icon: Rocket,
    href: "/execute",
    activeClass: "bg-phase-execute/15 text-phase-execute",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { projects, selectedCustomer, activeProject } = useProject();
  const customerOptions = Array.from(
    new Set(
      projects
        .map((p) => (p.customer || "").trim())
        .filter((c) => c.length > 0)
    )
  );

  const activeCustomer =
    selectedCustomer ||
    (activeProject?.customer || "").trim() ||
    customerOptions[0] ||
    "Customer";

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
              Capture · Orchestrate · Refine · Execute
            </p>
          </div>
        </Link>
        <div className="mt-2 flex items-center gap-2 px-1 py-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-base font-semibold">{activeCustomer}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/" aria-label="Dashboard" title="Dashboard" />} isActive={pathname === "/"}>
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
                    render={<Link href={item.href} aria-label={item.label} title={item.label} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      pathname.startsWith(item.href)
                        ? item.activeClass
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
                <SidebarMenuButton render={<Link href="/evidence" aria-label="All Evidence" title="All Evidence" />} isActive={pathname === "/evidence"}>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span>All Evidence</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/context" aria-label="Engagement Context" title="Engagement Context" />} isActive={pathname === "/context"}>
                  <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                  <span>Engagement Context</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/narrative" aria-label="Narrative" title="Narrative" />} isActive={pathname === "/narrative"}>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span>Narrative</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/search" aria-label="Web Search" title="Web Search" />} isActive={pathname === "/search"}>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>Web Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/methodology" aria-label="Methodology" title="Methodology" />} isActive={pathname === "/methodology"}>
                  <BookMarked className="h-4 w-4 text-muted-foreground" />
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
                <SidebarMenuButton render={<Link href="/engagements" aria-label="Engagements" title="Engagements" />} isActive={pathname === "/engagements"}>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>Engagements</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/company" aria-label="Company Research" title="Company Research" />} isActive={pathname === "/company"}>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>Company Research</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/reviews" aria-label="Reviews" title="Reviews" />} isActive={pathname === "/reviews"}>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
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
                <SidebarMenuButton render={<Link href="/m365" aria-label="Microsoft 365" title="Microsoft 365" />} isActive={pathname === "/m365"}>
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                  <span>Microsoft 365</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/grounding" aria-label="Grounded Answers" title="Grounded Answers" />} isActive={pathname === "/grounding"}>
                  <Wand2 className="h-4 w-4 text-muted-foreground" />
                  <span>Grounded Answers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/settings" aria-label="Settings" title="Settings" />} isActive={pathname === "/settings"}>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              v{APP_VERSION}
            </Badge>
            <span>CORE Framework</span>
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
