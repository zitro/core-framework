import { Skeleton } from "@/components/ui/skeleton";

export default function CompanyLoading() {
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
          <Skeleton className="h-7 w-56 sm:h-8 sm:w-64" />
        </div>
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </header>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}
