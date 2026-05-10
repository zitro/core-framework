import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Small uppercase eyebrow above the title (e.g. "CAPTURE PHASE"). */
  eyebrow?: string;
  /** Optional inline icon next to the title. Kept the same color as
   * text by default — colored chips on pastel backgrounds were the
   * audit's "templated AI" tell. */
  icon?: LucideIcon;
  /** Slot for primary actions (right-aligned). Buttons, dropdowns. */
  actions?: ReactNode;
  /** Optional accent token from globals.css (`phase-capture`,
   * `phase-orchestrate`, etc.). Renders as a 2px left bar — single
   * signal of phase, no colored card. */
  accent?: "capture" | "orchestrate" | "refine" | "execute" | "brand";
  className?: string;
}

const ACCENT_CLASSES: Record<NonNullable<PageHeaderProps["accent"]>, string> = {
  capture: "before:bg-phase-capture",
  orchestrate: "before:bg-phase-orchestrate",
  refine: "before:bg-phase-refine",
  execute: "before:bg-phase-execute",
  brand: "before:bg-brand",
};

/**
 * Type-led page header. Replaces the templated
 * `bg-X-500/10 rounded-lg with-icon` chip-on-pastel header pattern
 * that recurred across capture / context / evidence / search /
 * engagements / discoveries. Restraint-by-default: type does the
 * work, a 2px accent bar at the start signals phase when relevant,
 * and a thin 1px bottom rule separates header from content.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  accent,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex flex-col gap-3 border-b border-border pb-5 pt-2",
        accent &&
          [
            "before:absolute before:left-0 before:top-2 before:h-7 before:w-[3px] before:rounded-full",
            ACCENT_CLASSES[accent],
            "pl-4",
          ].join(" "),
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <div className="mt-0.5 flex items-center gap-2.5">
            {Icon && <Icon className="h-6 w-6 text-foreground/80" aria-hidden />}
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {title}
            </h1>
          </div>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
