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
import { VersionHistoryDialog } from "@/components/orient/version-history-dialog";

const VERSIONED_FIELDS = [
  "title",
  "one_liner",
  "problem",
  "desired_outcome",
  "scope_in",
  "scope_out",
  "constraints",
  "assumptions",
  "risks",
  "stakeholders",
  "success_metrics",
  "milestones",
  "notes",
] as const;

function isContextEmpty(c: EngagementContextRecord): boolean {
  return VERSIONED_FIELDS.every((f) => {
    const v = c[f];
    if (v == null) return true;
    if (typeof v === "string") return v.trim().length === 0;
    if (Array.isArray(v)) return v.length === 0;
    return false;
  });
}

export default function OrientPage() {
  const { activeProject } = useProject();
  const [ctx, setCtx] = useState<EngagementContextRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoDrafting, setAutoDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    const pid = activeProject?.id;
    if (!pid) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const c = await api.engagementContext.get(pid);
        if (cancelled) return;
        // First-touch auto-draft: if the brief is still empty, ask the
        // backend to draft from the corpus and persist as v1. The endpoint
        // is idempotent — it no-ops when the corpus has no docs or the
        // brief already has content, so it's safe to call on every load.
        if (isContextEmpty(c)) {
          setAutoDrafting(true);
          try {
            const drafted = await api.engagementContext.autoDraft(pid);
            if (!cancelled) setCtx(drafted);
          } catch {
            if (!cancelled) setCtx(c);
          } finally {
            if (!cancelled) setAutoDrafting(false);
          }
        } else {
          setCtx(c);
        }
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Compass className="h-6 w-6 text-amber-500" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Orient</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Frame the engagement: the problem, desired outcome, scope,
            stakeholders, risks, and success metrics. This brief grounds every
            AI call across Refine and Execute.
          </p>
        </div>
        {activeProject ? (
          <VersionHistoryDialog projectId={activeProject.id} refreshKey={historyKey} />
        ) : null}
      </header>

      {!activeProject ? (
        <NoProject />
      ) : loading || autoDrafting ? (
        <LoadingState autoDrafting={autoDrafting} />
      ) : error ? (
        <ErrorState message={error} />
      ) : showCtx ? (
        <EngagementBriefForm
          key={showCtx.project_id}
          initial={showCtx}
          onSaved={(c) => {
            setCtx(c);
            setHistoryKey((k) => k + 1);
          }}
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

function LoadingState({ autoDrafting }: { autoDrafting?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {autoDrafting
          ? "Drafting the engagement brief from your sources…"
          : "Loading engagement brief…"}
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
