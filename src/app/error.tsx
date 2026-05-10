"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route-level error boundary. Replaces the unstyled Next.js default
 * error page — gives users an actionable retry instead of a blank
 * white screen when a fetch fails or a render throws.
 */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Forward to whatever telemetry is wired (Sonner toast aside,
    // a real OTel span lands in Phase 5). For now: console.
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70">Reference: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
