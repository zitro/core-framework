"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Compass, Lightbulb, Rocket, ChevronRight } from "lucide-react";
import type { CorePhase, Discovery } from "@/types/core";
import { useDiscovery } from "@/stores/discovery-store";

const STEPS: { phase: CorePhase; label: string; icon: typeof Search; href: string; color: string; bg: string }[] = [
  { phase: "capture", label: "Capture", icon: Search, href: "/capture", color: "text-blue-600", bg: "bg-blue-500" },
  { phase: "orchestrate", label: "Orchestrate", icon: Compass, href: "/orchestrate", color: "text-amber-600", bg: "bg-amber-500" },
  { phase: "refine", label: "Refine", icon: Lightbulb, href: "/refine", color: "text-emerald-600", bg: "bg-emerald-500" },
  { phase: "execute", label: "Execute", icon: Rocket, href: "/execute", color: "text-violet-600", bg: "bg-violet-500" },
];

const PHASE_ORDER: CorePhase[] = ["capture", "orchestrate", "refine", "execute"];

function phaseIndex(phase: CorePhase) {
  return PHASE_ORDER.indexOf(phase);
}

/**
 * Did the user actually do something in this phase, or are we just
 * past it positionally? Audit flagged the old URL-only `isDone` as
 * misleading: clicking Refine from the dashboard checked off
 * Capture + Orchestrate even when empty. Data-driven check below.
 */
function phaseHasData(phase: CorePhase, discovery: Discovery | null): boolean {
  if (!discovery) return false;
  switch (phase) {
    case "capture":
      return (discovery.evidence?.length ?? 0) > 0;
    case "orchestrate":
      return Boolean(discovery.problem_statement);
    case "refine":
      return (
        (discovery.assumptions?.length ?? 0) > 0 ||
        (discovery.solution_matches?.length ?? 0) > 0
      );
    case "execute":
      return Boolean(discovery.execute_data);
  }
}

export function PhaseProgress({ currentPhase }: { currentPhase: CorePhase }) {
  const pathname = usePathname();
  const { activeDiscovery } = useDiscovery();
  const activeIdx = phaseIndex(currentPhase);

  return (
    <nav className="flex items-center gap-1 w-full overflow-x-auto py-1">
      {STEPS.map((step, idx) => {
        const isActive = pathname.startsWith(step.href);
        // isDone is now real progress: the phase has captured data.
        // Falls back to positional ordering only when there's no
        // active discovery yet (cold-start states still show a sane
        // progression bar).
        const isDone = activeDiscovery
          ? phaseHasData(step.phase, activeDiscovery)
          : idx < activeIdx;
        const isCurrent = idx === activeIdx;
        const Icon = step.icon;

        return (
          <div key={step.phase} className="flex items-center">
            <Link
              href={step.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? `${step.bg} text-white`
                  : isDone
                    ? "bg-muted text-foreground"
                    : isCurrent
                      ? `${step.bg}/10 ${step.color} ring-1 ring-current`
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                isActive ? "bg-white/20" : isDone ? "bg-primary/10" : ""
              }`}>
                {isDone ? "✓" : <Icon className="h-3 w-3" />}
              </span>
              {step.label}
            </Link>
            {idx < STEPS.length - 1 && (
              <ChevronRight className={`h-3.5 w-3.5 mx-0.5 shrink-0 ${
                idx < activeIdx ? "text-muted-foreground" : "text-muted-foreground/40"
              }`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function NextPhaseCTA({ currentPhase }: { currentPhase: CorePhase }) {
  const idx = phaseIndex(currentPhase);
  if (idx >= STEPS.length - 1) return null;
  const next = STEPS[idx + 1];
  const NextIcon = next.icon;

  return (
    <div className="flex items-center justify-end pt-2 mt-6">
      <Link
        href={next.href}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${next.bg}/10 ${next.color} hover:${next.bg}/20`}
      >
        Continue to {next.label}
        <NextIcon className="h-4 w-4" />
        <ChevronRight className="h-3.5 w-3.5 -ml-1" />
      </Link>
    </div>
  );
}
