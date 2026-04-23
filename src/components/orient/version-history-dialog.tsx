"use client";

/**
 * VersionHistoryDialog — read-only browser for EngagementContext snapshots.
 *
 * Lists every prior version of the engagement brief (most recent first)
 * and lets the user inspect any snapshot. Versions are written by the
 * backend on every PUT and on auto-draft, so this is the audit trail
 * for "what did the brief say at this point in time".
 */

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  api,
  type EngagementContextVersion,
  type EngagementContextVersionRow,
} from "@/lib/api";

interface Props {
  projectId: string;
  /** Bumps when caller knows the underlying brief changed. */
  refreshKey?: number;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  one_liner: "One-liner",
  phase: "Phase",
  problem: "Problem",
  desired_outcome: "Desired outcome",
  scope_in: "In scope",
  scope_out: "Out of scope",
  constraints: "Constraints",
  assumptions: "Assumptions",
  risks: "Risks",
  stakeholders: "Stakeholders",
  success_metrics: "Success metrics",
  milestones: "Milestones",
  notes: "Notes",
};

function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function sourceVariant(source: string): "default" | "secondary" | "outline" {
  if (source === "auto-draft") return "secondary";
  if (source === "manual") return "default";
  return "outline";
}

function renderValue(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "string") return (value as string[]).join("\n• ");
    return value
      .map((v) => {
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          return String(o.name ?? o.label ?? JSON.stringify(o));
        }
        return String(v);
      })
      .join("\n• ");
  }
  if (typeof value === "string") return value || "—";
  return JSON.stringify(value);
}

export function VersionHistoryDialog({ projectId, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EngagementContextVersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EngagementContextVersion | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api.engagementContext
      .versions(projectId)
      .then((res) => {
        if (cancelled) return;
        setRows(res.versions);
        setSelected(null);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, refreshKey]);

  const openSnapshot = async (id: string) => {
    setLoadingSnapshot(true);
    try {
      const v = await api.engagementContext.version(projectId, id);
      setSelected(v);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const snapshotEntries = selected
    ? Object.entries(FIELD_LABELS).filter(([k]) => {
        const v = selected.snapshot[k as keyof typeof selected.snapshot];
        if (v == null) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "string") return v.trim().length > 0;
        return true;
      })
    : [];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <History className="mr-1.5 h-3.5 w-3.5" />
        History
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Brief history</DialogTitle>
          <DialogDescription>
            Every save creates a snapshot. Click a version to view what the
            brief looked like at that point.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[220px_1fr] gap-4">
          <ScrollArea className="h-[420px] rounded-md border">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No previous versions yet. Saves and auto-drafts create
                versions you can review here.
              </div>
            ) : (
              <ul className="divide-y">
                {rows.map((r) => {
                  const active = selected?.id === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => openSnapshot(r.id)}
                        className={`w-full px-3 py-2 text-left text-sm transition hover:bg-accent ${
                          active ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">v{r.version}</span>
                          <Badge variant={sourceVariant(r.source)} className="text-[10px]">
                            {r.source || "manual"}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatTime(r.created_at)}
                        </div>
                        {r.summary ? (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {r.summary}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
          <ScrollArea className="h-[420px] rounded-md border p-3">
            {loadingSnapshot ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading snapshot…
              </div>
            ) : !selected ? (
              <div className="text-sm text-muted-foreground">
                Select a version on the left to preview its contents.
              </div>
            ) : snapshotEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                This snapshot was empty.
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                {snapshotEntries.map(([k, label]) => {
                  const v = selected.snapshot[k as keyof typeof selected.snapshot];
                  const text = renderValue(v);
                  const isList = Array.isArray(v) && v.length > 0;
                  return (
                    <div key={k}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-foreground">
                        {isList ? `• ${text}` : text}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </ScrollArea>
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
