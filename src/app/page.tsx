"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Compass,
  Lightbulb,
  Plus,
  Rocket,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProject } from "@/stores/project-store";
import { useDiscovery } from "@/stores/discovery-store";
import { ENGAGEMENT_STATUS_LABELS } from "@/types/fde";
import { engagementsApi } from "@/lib/api-fde";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import type { CorePhase } from "@/types/core";

interface PhaseCard {
  phase: CorePhase;
  label: string;
  icon: LucideIcon;
  href: string;
  accent: string;
  ring: string;
  description: string;
}

const PHASES: PhaseCard[] = [
  {
    phase: "capture",
    label: "Capture",
    icon: Search,
    href: "/context",
    accent: "text-blue-500",
    ring: "border-blue-500/30 bg-blue-500/5",
    description: "Pull in transcripts, docs, and evidence.",
  },
  {
    phase: "orient",
    label: "Orient",
    icon: Compass,
    href: "/synthesis",
    accent: "text-amber-500",
    ring: "border-amber-500/30 bg-amber-500/5",
    description: "Cluster signals into themes and questions.",
  },
  {
    phase: "refine",
    label: "Refine",
    icon: Lightbulb,
    href: "/narrative",
    accent: "text-emerald-500",
    ring: "border-emerald-500/30 bg-emerald-500/5",
    description: "Shape the story, evidence, and hypotheses.",
  },
  {
    phase: "execute",
    label: "Execute",
    icon: Rocket,
    href: "/engagements",
    accent: "text-violet-500",
    ring: "border-violet-500/30 bg-violet-500/5",
    description: "Land plans, reviews, and handoffs.",
  },
];

export default function DashboardPage() {
  const {
    projects,
    activeProject,
    setActiveProject,
    loading: projectsLoading,
    refresh,
  } = useProject();
  const { discoveries, activeDiscovery } = useDiscovery();
  const [open, setOpen] = useState(false);

  const phaseCounts = useMemo(() => {
    const counts: Record<CorePhase, number> = {
      capture: 0,
      orient: 0,
      refine: 0,
      execute: 0,
    };
    for (const d of discoveries) counts[d.current_phase]++;
    return counts;
  }, [discoveries]);

  const handleCreated = async (created: { id: string }) => {
    await refresh();
    const list = await engagementsApi.list();
    const fresh = list.find((p) => p.id === created.id) ?? null;
    if (fresh) setActiveProject(fresh);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CORE</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Capture · Orient · Refine · Execute â€” your project workbench.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </header>

      {activeProject ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Briefcase className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">
                    {activeProject.name}
                  </CardTitle>
                  <CardDescription className="text-xs truncate">
                    {activeProject.customer || "No customer"} ·{" "}
                    {activeProject.industry || "â€”"}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">
                {ENGAGEMENT_STATUS_LABELS[activeProject.status]}
              </Badge>
            </CardHeader>
            {activeProject.summary && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {activeProject.summary}
                </p>
              </CardContent>
            )}
          </Card>

          <section aria-labelledby="phases-heading">
            <h2
              id="phases-heading"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3"
            >
              Phases
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {PHASES.map((p) => {
                const Icon = p.icon;
                const count = phaseCounts[p.phase];
                return (
                  <Link key={p.phase} href={p.href} aria-label={`Open ${p.label}`}>
                    <Card
                      className={`cursor-pointer hover:shadow-md transition-all border ${p.ring} h-full`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${p.accent}`} />
                            <CardTitle className="text-sm">{p.label}</CardTitle>
                          </div>
                          {count > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {count}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-xs">
                          {p.description}
                        </CardDescription>
                        <div className="mt-3 flex items-center gap-1 text-xs text-primary">
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="discoveries-heading">
            <h2
              id="discoveries-heading"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3"
            >
              Discoveries in this project
            </h2>
            {discoveries.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    No discoveries yet for {activeProject.name}.
                  </p>
                  <Link href="/context">
                    <Button variant="outline">Start in Capture</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {discoveries.slice(0, 6).map((d) => (
                  <Card
                    key={d.id}
                    className={`hover:shadow-sm transition-shadow ${
                      activeDiscovery?.id === d.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm truncate" title={d.name}>
                          {d.name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize shrink-0"
                        >
                          {d.current_phase}
                        </Badge>
                      </div>
                      {d.description && (
                        <CardDescription className="text-xs line-clamp-2">
                          {d.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Briefcase className="h-8 w-8 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">
                  {projectsLoading ? "Loading projectsâ€¦" : "No project selected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {projects.length === 0
                    ? "Create a project to organize your discoveries."
                    : "Pick a project from the switcher in the sidebar to begin."}
                </p>
              </div>
              {projects.length === 0 && (
                <Button onClick={() => setOpen(true)} className="gap-2 mt-2">
                  <Plus className="h-4 w-4" />
                  Create First Project
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <NewProjectDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}