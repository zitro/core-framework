import { Skeleton } from "@/components/ui/skeleton";

export default function NarrativeLoading() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-6 p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="flex flex-col gap-3 border-b border-border pb-5 pt-2">
        <Skeleton className="h-3 w-16" />
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-7 w-64 sm:h-8 sm:w-72" />
        </div>
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </header>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}
