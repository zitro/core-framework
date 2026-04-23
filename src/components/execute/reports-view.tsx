"use client";

/**
 * ReportsView — dense, scannable list of artifacts for status-report use.
 *
 * Same dataset as the gallery view but rendered as compact rows grouped
 * by category, with quick "Open" actions. Used when /execute is loaded
 * with ?view=reports (and reachable via the legacy /reports redirect).
 */

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SynthesisArtifact, SynthesisCategoryId } from "@/lib/api-synthesis";

interface Props {
  artifacts: SynthesisArtifact[];
  categoryLabels: Record<SynthesisCategoryId, string>;
  onOpen?: (artifact: SynthesisArtifact) => void;
}

export function ReportsView({ artifacts, categoryLabels, onOpen }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<SynthesisCategoryId, SynthesisArtifact[]>();
    for (const a of artifacts) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [artifacts]);

  if (artifacts.length === 0) return null;

  return (
    <div className="space-y-4">
      {grouped.map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">
              {categoryLabels[cat] ?? cat}
            </CardTitle>
            <Badge variant="outline">{items.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {a.summary || a.type_id}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{a.type_id}</Badge>
                      <span>v{a.version}</span>
                      <span>· {a.status}</span>
                    </div>
                  </div>
                  {onOpen && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpen(a)}
                      aria-label={`Open ${a.title}`}
                    >
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
