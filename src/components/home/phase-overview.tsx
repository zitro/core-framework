import Link from "next/link";
import {
  Search,
  Compass,
  Lightbulb,
  Rocket,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { CorePhase } from "@/types/core";
import { PHASE_CONFIG } from "@/types/core";
import { cn } from "@/lib/utils";

const PHASE_ICONS: Record<CorePhase, LucideIcon> = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
};

const PHASE_RAIL: Record<CorePhase, string> = {
  capture: "before:bg-phase-capture",
  orchestrate: "before:bg-phase-orchestrate",
  refine: "before:bg-phase-refine",
  execute: "before:bg-phase-execute",
};

const PHASE_ICON_TINT: Record<CorePhase, string> = {
  capture: "text-phase-capture",
  orchestrate: "text-phase-orchestrate",
  refine: "text-phase-refine",
  execute: "text-phase-execute",
};

const PHASES: CorePhase[] = ["capture", "orchestrate", "refine", "execute"];

/**
 * Four cards orienting the user to the CORE workflow. Each card carries
 * a 1px left rail in the phase's semantic token (matches the brand
 * identity work in P5-2). Restrained: no chip backgrounds, no big
 * illustrations — just type, a small icon, and a hover arrow.
 */
export function PhaseOverview() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          The CORE workflow
        </h2>
        <span className="text-xs text-muted-foreground">
          Capture · Orchestrate · Refine · Execute
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PHASES.map((phase, i) => {
          const config = PHASE_CONFIG[phase];
          const Icon = PHASE_ICONS[phase];
          return (
            <Link
              key={phase}
              href={`/${phase}`}
              className={cn(
                "group relative overflow-hidden rounded-xl bg-white border border-gray-200 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5",
                "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-l-xl",
                PHASE_RAIL[phase],
              )}
              aria-label={`Open ${config.label}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Step {i + 1}
                    </span>
                    <Icon
                      className={cn("h-3.5 w-3.5", PHASE_ICON_TINT[phase])}
                      aria-hidden
                    />
                  </div>
                  <p className="font-heading text-sm font-semibold tracking-tight">
                    {config.label}
                  </p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {config.description}
                  </p>
                </div>
                <ArrowRight
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
