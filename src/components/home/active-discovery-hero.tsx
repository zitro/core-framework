"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Search,
  Compass,
  Lightbulb,
  Rocket,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { CorePhase, Discovery } from "@/types/core";
import { MODE_CONFIG, PHASE_CONFIG } from "@/types/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PHASE_ICONS: Record<CorePhase, LucideIcon> = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
};

const PHASE_ACCENT: Record<CorePhase, string> = {
  capture: "bg-phase-capture text-phase-capture",
  orchestrate: "bg-phase-orchestrate text-phase-orchestrate",
  refine: "bg-phase-refine text-phase-refine",
  execute: "bg-phase-execute text-phase-execute",
};

const PHASE_RAIL: Record<CorePhase, string> = {
  capture: "before:bg-phase-capture",
  orchestrate: "before:bg-phase-orchestrate",
  refine: "before:bg-phase-refine",
  execute: "before:bg-phase-execute",
};

const PHASES: CorePhase[] = ["capture", "orchestrate", "refine", "execute"];

/**
 * Hero card on the dashboard that surfaces the active discovery so the
 * user can pick up where they left off. Shows the discovery name, the
 * current phase with a 4-step progress strip, key stats, and a single
 * primary CTA that jumps into the current phase.
 */
export function ActiveDiscoveryHero({ discovery }: { discovery: Discovery }) {
  const currentPhase = discovery.current_phase;
  const PhaseIcon = PHASE_ICONS[currentPhase];
  const phaseConfig = PHASE_CONFIG[currentPhase];
  const mode = MODE_CONFIG[discovery.mode];

  const evidenceCount = discovery.evidence?.length ?? 0;
  const assumptionsCount = discovery.assumptions?.length ?? 0;
  const hasProblemStatement = Boolean(discovery.problem_statement);
  const updatedAt = useMemo(() => formatRelative(discovery.updated_at), [discovery.updated_at]);

  const currentIndex = PHASES.indexOf(currentPhase);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-l-xl",
        PHASE_RAIL[currentPhase],
      )}
    >
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>Active discovery</span>
              <span aria-hidden>·</span>
              <span>{mode.label}</span>
              {updatedAt && (
                <>
                  <span aria-hidden>·</span>
                  <span>Updated {updatedAt}</span>
                </>
              )}
            </div>
            <h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {discovery.name}
            </h2>
            {discovery.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {discovery.description}
              </p>
            )}
          </div>
          <Button
            render={<Link href={`/${currentPhase}`} aria-label={`Continue in ${phaseConfig.label}`} />}
            size="sm"
            nativeButton={false}
            className="shrink-0"
          >
            Continue in {phaseConfig.label}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Current phase" icon={PhaseIcon} accent={PHASE_ACCENT[currentPhase]}>
            {phaseConfig.label}
          </Stat>
          <Stat label="Evidence captured" valueClass="font-heading text-2xl">
            {evidenceCount}
          </Stat>
          <Stat label="Tracked assumptions" valueClass="font-heading text-2xl">
            {assumptionsCount}
          </Stat>
        </div>

        <div className="mt-6">
          <ol
            className="flex items-center gap-2"
            aria-label="Discovery phase progress"
          >
            {PHASES.map((phase, i) => {
              const Icon = PHASE_ICONS[phase];
              const config = PHASE_CONFIG[phase];
              const isCurrent = i === currentIndex;
              const isDone = i < currentIndex;
              return (
                <li key={phase} className="flex flex-1 items-center gap-2">
                  <Link
                    href={`/${phase}`}
                    className={cn(
                      "group flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60",
                      isCurrent && "bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        isCurrent
                          ? PHASE_ACCENT[phase].replace("text-", "text-").replace("bg-", "bg-") + "/15"
                          : isDone
                            ? "bg-foreground/10 text-foreground/70"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isDone ? "✓" : i + 1}
                    </span>
                    <span
                      className={cn(
                        "truncate text-xs",
                        isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {config.label}
                    </span>
                    <Icon
                      className={cn(
                        "ml-auto h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-70",
                        isCurrent && "opacity-70",
                      )}
                      aria-hidden
                    />
                  </Link>
                  {i < PHASES.length - 1 && (
                    <span
                      className={cn(
                        "h-px w-3 shrink-0",
                        isDone ? "bg-foreground/30" : "bg-border",
                      )}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {hasProblemStatement && (
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              Problem statement
            </Badge>
            <span className="text-xs text-muted-foreground">Drafted</span>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  icon: Icon,
  accent,
  valueClass,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  accent?: string;
  valueClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-2">
        {Icon && (
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              accent ? accent.replace("text-", "text-").replace("bg-", "bg-") + "/15" : "bg-muted",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", accent && accent.split(" ").find((c) => c.startsWith("text-")))} aria-hidden />
          </span>
        )}
        <span className={cn("font-medium", valueClass)}>{children}</span>
      </div>
    </div>
  );
}

function formatRelative(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}
