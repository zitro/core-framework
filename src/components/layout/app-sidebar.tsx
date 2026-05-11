"use client";

import packageJson from "../../../package.json";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Compass, Lightbulb, Rocket, Home, BookOpen, BookMarked, Building2, Briefcase, ShieldCheck, Settings } from "lucide-react";
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
          <Image
            src="/brand/core_logoSymbol_nobg.png"
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11 shrink-0"
          />
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <Image
                src="/brand/core_logoText_nobg.png"
                alt="CORE"
                width={96}
                height={30}
                priority
                className="h-6 w-auto dark:invert"
              />
              <span>Discovery</span>
            </h2>
            <p className="whitespace-nowrap text-[10px] text-muted-foreground">
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
                <SidebarMenuButton render={<Link href="/insights" aria-label="Insights" title="Insights" />} isActive={pathname === "/insights" || pathname.startsWith("/insights?")}>
                  <Compass className="h-4 w-4 text-muted-foreground" />
                  <span>Insights</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/evidence" aria-label="All Evidence" title="All Evidence" />} isActive={pathname === "/evidence"}>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span>All Evidence</span>
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
                <SidebarMenuButton render={<Link href="/reviews" aria-label="Reviews" title="Reviews" />} isActive={pathname === "/reviews"}>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span>Reviews</span>
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
