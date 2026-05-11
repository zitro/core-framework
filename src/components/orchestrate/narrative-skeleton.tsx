import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the Narrative tab. Mirrors the document shape
 *  (eyebrow pills, headline, summary, three body sections) so the
 *  page doesn't jump when the real prose arrives. */
export function NarrativeSkeleton() {
  return (
    <div
      className="rounded-lg border bg-card px-6 py-7 sm:px-9 sm:py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-[65ch] space-y-7">
        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/4 sm:h-8" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </header>
        {[1, 2, 3].map((i) => (
          <section key={i} className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[97%]" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-3/4" />
          </section>
        ))}
      </div>
    </div>
  );
}
