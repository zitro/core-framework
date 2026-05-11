"use client";

/**
 * Inbox — actionable open items across the discovery.
 *
 * Purpose: one place to see what still needs attention without paging
 * through every tab. Pulls three streams from /api/insights/inbox:
 *   - Open questions (latest question set per phase)
 *   - Unvalidated assumptions
 *   - Recent thread comments (last 10 across all artifacts)
 */

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, ShieldAlert, HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { request } from "@/lib/http";

interface InboxQuestion {
  text: string;
  purpose: string;
  set_id: string;
  set_phase: string;
  created_at: string;
}

interface InboxAssumption {
  id: string;
  statement: string;
  confidence: string;
  impact: string;
}

interface InboxComment {
  id: string;
  thread_id: string;
  artifact_id: string;
  project_id: string;
  role: string;
  author: string;
  body: string;
  created_at: string;
}

interface InboxResponse {
  open_questions: InboxQuestion[];
  unvalidated_assumptions: InboxAssumption[];
  recent_comments: InboxComment[];
}

interface Props {
  discoveryId: string;
}

export function Inbox({ discoveryId }: Props) {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!discoveryId) return;
    let cancelled = false;
    setLoading(true);
    request<InboxResponse>(
      `/api/insights/inbox?discovery_id=${encodeURIComponent(discoveryId)}`,
    )
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load inbox");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryId]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading inbox…
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  const totalOpen =
    data.open_questions.length +
    data.unvalidated_assumptions.length +
    data.recent_comments.length;

  if (totalOpen === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing in the inbox. All open items have been addressed.
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Section
        icon={HelpCircle}
        title="Open questions"
        count={data.open_questions.length}
        emptyText="No open questions."
      >
        {data.open_questions.map((q, i) => (
          <Item
            key={`${q.set_id}:${i}`}
            primary={q.text}
            secondary={q.purpose}
            badge={q.set_phase}
          />
        ))}
      </Section>

      <Section
        icon={ShieldAlert}
        title="Unvalidated assumptions"
        count={data.unvalidated_assumptions.length}
        emptyText="No open assumptions."
      >
        {data.unvalidated_assumptions.map((a) => (
          <Item
            key={a.id}
            primary={a.statement}
            secondary={a.impact}
            badge={a.confidence}
          />
        ))}
      </Section>

      <Section
        icon={MessageSquare}
        title="Recent comments"
        count={data.recent_comments.length}
        emptyText="No recent comments."
      >
        {data.recent_comments.map((c) => (
          <Item
            key={c.id}
            primary={c.body}
            secondary={`${c.author || c.role} · ${formatDate(c.created_at)}`}
            badge={c.role}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  emptyText,
  children,
}: {
  icon: typeof HelpCircle;
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{title}</span>
        <span className="text-[10px] text-muted-foreground/70">· {count}</span>
      </div>
      {count === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">{children}</ul>
      )}
    </section>
  );
}

function Item({
  primary,
  secondary,
  badge,
}: {
  primary: string;
  secondary: string;
  badge: string;
}) {
  return (
    <li className="border-l-2 border-muted py-0.5 pl-2.5 transition-colors hover:border-brand/60">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-foreground/85">{primary}</p>
        {badge && (
          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
            {badge}
          </Badge>
        )}
      </div>
      {secondary && (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{secondary}</p>
      )}
    </li>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}
