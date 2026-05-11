import { Skeleton } from "@/components/ui/skeleton";

export default function MethodologyLoading() {
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
          <Skeleton className="h-7 w-44 sm:h-8 sm:w-52" />
        </div>
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </header>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="border-l-2 pl-3 space-y-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
