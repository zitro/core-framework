"use client";

/**
 * /orient — engagement brief.
 *
 * Loads the typed EngagementContext for the active project and renders
 * an editable form. Save persists to DB; the .md projection happens via
 * Settings → Engagement (multi-source picker lives there in E phase).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProject } from "@/stores/project-store";
import { api, type EngagementContextRecord } from "@/lib/api";
import { EngagementBriefForm } from "@/components/orient/engagement-brief-form";

export default function OrientPage() {
  const { activeProject } = useProject();
  const [ctx, setCtx] = useState<EngagementContextRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pid = activeProject?.id;
    if (!pid) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const c = await api.engagementContext.get(pid);
        if (!cancelled) setCtx(c);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load brief");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  const showCtx = ctx && activeProject && ctx.project_id === activeProject.id ? ctx : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Compass className="h-6 w-6 text-amber-500" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Orient</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Frame the engagement: the problem, desired outcome, scope,
          stakeholders, risks, and success metrics. This brief grounds every
          AI call across Refine and Execute.
        </p>
      </header>

      {!activeProject ? (
        <NoProject />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : showCtx ? (
        <EngagementBriefForm
          key={showCtx.project_id}
          initial={showCtx}
          onSaved={(c) => setCtx(c)}
        />
      ) : null}
    </div>
  );
}

function NoProject() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No active project</CardTitle>
        <CardDescription>
          Pick a project from the top-left switcher to load its engagement brief.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/">
          <Button variant="outline">Go to dashboard</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading engagement brief…
      </CardContent>
    </Card>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Couldn&apos;t load brief</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
    </Card>
  );
}
