"use client";

/**
 * ActivityFeed — newest-first list of events across the discovery.
 *
 * Purpose: "where was I last?" Combines evidence captures, AI
 * generations (briefs / problems / use cases / reviews / blueprints),
 * and comments into one chronological view. Each event has a surface
 * link so users can jump back to where they left off.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { request } from "@/lib/http";

interface ActivityEvent {
  kind: string;
  title: string;
  summary: string;
  surface: string;
  created_at: string;
}

interface ActivityResponse {
  events: ActivityEvent[];
}

interface Props {
  discoveryId: string;
}

const KIND_ICON: Record<string, typeof BookOpen> = {
  evidence: BookOpen,
  brief: Sparkles,
  problem: FileText,
  usecase: FileText,
  review: Sparkles,
  blueprint: Sparkles,
  comment: MessageSquare,
};

export function ActivityFeed({ discoveryId }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!discoveryId) return;
    let cancelled = false;
    setLoading(true);
    request<ActivityResponse>(
      `/api/insights/activity?discovery_id=${encodeURIComponent(discoveryId)}`,
    )
      .then((next) => {
        if (!cancelled) setEvents(next.events);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryId]);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading activity…
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No activity yet. Capture evidence or generate an AI artifact to start the log.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((event, i) => {
        const Icon = KIND_ICON[event.kind] ?? Sparkles;
        return (
          <li
            key={`${event.created_at}:${i}`}
            className="group rounded-md border bg-card px-3 py-2 transition-colors hover:border-brand/40"
          >
            <Link href={event.surface} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-brand">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-medium">{event.title}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                    {event.kind}
                  </Badge>
                </div>
                {event.summary && (
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {event.summary}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70">{formatDate(event.created_at)}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.round(diff / min)}m ago`;
  if (diff < day) return `${Math.round(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return d.toLocaleDateString();
}
