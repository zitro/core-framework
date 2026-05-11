"use client";

/**
 * StakeholderMap — roll-up of who's involved, grouped by org.
 *
 * Purpose: one card per org with the people in it. Helps with hand-offs,
 * intro-call prep, and seeing who's missing from the picture.
 *
 * Pulls from /api/insights/stakeholders which combines discovery.stakeholders
 * + the engagement_context stakeholder list, deduped by name+role.
 */

import { useEffect, useState } from "react";
import { Building2, Loader2, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { request } from "@/lib/http";

interface Stakeholder {
  name: string;
  role: string;
  org: string;
  influence: string;
  source: string;
}

interface StakeholdersResponse {
  by_org: Record<string, Stakeholder[]>;
  total: number;
}

interface Props {
  discoveryId: string;
}

export function StakeholderMap({ discoveryId }: Props) {
  const [data, setData] = useState<StakeholdersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!discoveryId) return;
    let cancelled = false;
    setLoading(true);
    request<StakeholdersResponse>(
      `/api/insights/stakeholders?discovery_id=${encodeURIComponent(discoveryId)}`,
    )
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load stakeholders");
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
        Loading stakeholders…
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  if (data.total === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No stakeholders captured yet. Add them in Orchestrate → Overview → engagement context.
      </p>
    );
  }

  const orgs = Object.entries(data.by_org).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="font-medium">Total</span>
        <span className="text-foreground/85">{data.total}</span>
        <span>·</span>
        <span>{orgs.length} org{orgs.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {orgs.map(([org, people]) => (
          <section key={org} className="rounded-md border bg-card px-3 py-2.5">
            <header className="flex items-baseline gap-1.5 pb-2">
              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
              <p className="truncate text-xs font-medium">{org}</p>
              <span className="ml-auto text-[10px] text-muted-foreground">{people.length}</span>
            </header>
            <ul className="space-y-1.5">
              {people.map((p, i) => (
                <li
                  key={`${p.name}:${i}`}
                  className="border-l-2 border-muted py-0.5 pl-2.5 transition-colors hover:border-brand/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-medium">
                        <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {p.name}
                      </p>
                      {p.role && (
                        <p className="ml-4 text-[11px] text-muted-foreground">{p.role}</p>
                      )}
                    </div>
                    {p.influence && (
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                        {p.influence}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
