import type { CorePhase } from "@/types/core";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ACCENT: Record<CorePhase, string> = {
  capture: "before:bg-phase-capture",
  orchestrate: "before:bg-phase-orchestrate",
  refine: "before:bg-phase-refine",
  execute: "before:bg-phase-execute",
};

/**
 * Loading skeleton that mirrors PhaseShell's layout: progress stepper,
 * PageHeader signature treatment (eyebrow + title + description + 2px
 * accent bar), guidance block, and a Tabs-shaped content area. Keeps
 * the layout from jumping when the real RSC stream lands.
 */
export function PhaseSkeleton({ phase }: { phase: CorePhase }) {
  return (
    <div
      className="mx-auto max-w-6xl space-y-5 p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-16" />
            {i < 4 && <Skeleton className="h-px flex-1" />}
          </div>
        ))}
      </div>

      <header
        className={cn(
          "relative flex flex-col gap-3 border-b border-border pb-5 pt-2 pl-4",
          "before:absolute before:left-0 before:top-2 before:h-7 before:w-[3px] before:rounded-full",
          ACCENT[phase],
        )}
      >
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-7 w-44 sm:h-8 sm:w-56" />
        </div>
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </header>

      <div className="space-y-2 rounded-lg border bg-muted/30 px-4 py-3">
        <Skeleton className="h-4 w-72" />
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-3 w-[80%]" />
          <Skeleton className="h-3 w-[75%]" />
          <Skeleton className="h-3 w-[60%]" />
        </div>
      </div>

      <div className="flex gap-1.5">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="rounded-lg border border-border p-4 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
