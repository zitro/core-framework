"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import pkg from "../../../package.json";
import {
  BookMarked,
  FileBarChart2,
  FileStack,
  FolderGit2,
  Home,
  Layers,
  type LucideIcon,
  Settings2,
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
import { useProject } from "@/stores/project-store";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  conditional?: "hasRepo";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Work",
    items: [
      { label: "Dashboard", href: "/", icon: Home },
      { label: "Synthesis", href: "/synthesis", icon: Wand2 },
      { label: "Artifacts", href: "/artifacts", icon: FileStack },
      {
        label: "Vertex Repo",
        href: "/vertex",
        icon: FolderGit2,
        badge: "v2",
        conditional: "hasRepo",
      },
    ],
  },
  {
    label: "Insight",
    items: [
      { label: "Sources", href: "/sources", icon: Layers, badge: "v2" },
      { label: "Reports", href: "/reports", icon: FileBarChart2, badge: "v2" },
    ],
  },
  {
    label: "Reference",
    items: [{ label: "Methodology", href: "/methodology", icon: BookMarked }],
  },
];

const SETTINGS_ITEM: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings2,
};

const FRAMEWORK_VERSION = pkg.version;

export function AppSidebar() {
  const pathname = usePathname();
  const { activeProject } = useProject();
  const hasRepo = !!activeProject?.repo_path;
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
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="uppercase tracking-wider">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items
                  .filter((item) => !item.conditional || (item.conditional === "hasRepo" && hasRepo))
                  .map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={
                            item.href === "/" ? pathname === "/" : isActive(item.href)
                          }
                        >
                          <ItemIcon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {item.badge && (
                            <Badge variant="outline" className="ml-auto text-[9px]">
                              {item.badge}
                            </Badge>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={SETTINGS_ITEM.href} />}
                  isActive={isActive(SETTINGS_ITEM.href)}
                >
                  <SETTINGS_ITEM.icon className="h-4 w-4" />
                  <span>{SETTINGS_ITEM.label}</span>
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