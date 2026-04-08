"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Compass, Lightbulb, Rocket, Home, BookOpen } from "lucide-react";
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

const PHASE_NAV = [
  {
    phase: "capture",
    label: "Capture",
    icon: Search,
    href: "/capture",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    phase: "orient",
    label: "Orient",
    icon: Compass,
    href: "/orient",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    phase: "refine",
    label: "Refine",
    icon: Lightbulb,
    href: "/refine",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    phase: "execute",
    label: "Execute",
    icon: Rocket,
    href: "/execute",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
];

export function AppSidebar() {
  const pathname = usePathname();

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
                    <item.icon className={`h-4 w-4 ${item.color}`} />
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
                  <span>Evidence Board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            v0.1.0
          </Badge>
          <span>CORE Framework</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
