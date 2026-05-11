import { Skeleton } from "@/components/ui/skeleton";

/**
 * Default route-level loading state. Renders a header-shaped
 * skeleton + card grid so the user perceives structure during the
 * RSC streaming wait instead of a flash of empty space.
 */
export default function Loading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" aria-busy="true" aria-live="polite">
      {/* Header skeleton mirrors the PageHeader shape so layout
          doesn't jump when content arrives. */}
      <div className="space-y-3 border-b border-border pb-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
