import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

/**
 * Custom 404 page. Replaces the unstyled Next default that breaks
 * the visual spell whenever a user lands on a moved or mistyped URL.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">404</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for has moved or never existed.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </div>
  );
}
