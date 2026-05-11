import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon rendered above the title at muted color. */
  icon: LucideIcon;
  /** Headline. Kept short — one line, sentence case. */
  title: string;
  /** One-sentence explanation of WHY the state is empty + what to do. */
  description?: string;
  /** Slot for primary + secondary CTAs (buttons, links). */
  actions?: ReactNode;
  /** When true, drops the dashed border so the state can sit inside an
   *  existing card without double-bordering. */
  bare?: boolean;
  className?: string;
}

/**
 * Restrained empty state. Single muted icon, type-led, narrow content.
 * Use anywhere the user lands on a surface that has no content yet
 * (cold-start), or after a destructive action emptied a list.
 *
 * Avoids the "huge illustration + 6 sentences" template pattern the
 * audit flagged on the older empty surfaces.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  bare = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center justify-center gap-3 py-16 text-center",
        !bare && "rounded-lg border border-dashed border-border",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold tracking-tight">
          {title}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="mt-1 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
