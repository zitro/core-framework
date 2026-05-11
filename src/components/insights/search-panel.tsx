"use client";

/**
 * SearchPanel — full-text search across the active discovery.
 *
 * Purpose: "where did I see X?" Hits evidence + briefs + problem
 * statements + use cases + thread comments, ranked by term frequency.
 * Each result has a jump-to-surface link.
 */

import { useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { request } from "@/lib/http";

interface SearchHit {
  kind: string;
  title: string;
  snippet: string;
  surface: string;
  score: number;
}

interface SearchResponse {
  query: string;
  hits: SearchHit[];
  total: number;
}

interface Props {
  discoveryId: string;
}

export function SearchPanel({ discoveryId }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const next = await request<SearchResponse>(
        `/api/insights/search?discovery_id=${encodeURIComponent(discoveryId)}&q=${encodeURIComponent(q.trim())}`,
      );
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          placeholder="Search evidence, briefs, drafts, comments…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={loading || !q.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && data.hits.length === 0 && (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No matches for &ldquo;{data.query}&rdquo;.
        </p>
      )}

      {data && data.hits.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {data.total} match{data.total === 1 ? "" : "es"}
          </p>
          <ul className="space-y-2">
            {data.hits.map((h, i) => (
              <li
                key={`${h.surface}:${i}`}
                className="group rounded-md border bg-card transition-colors hover:border-brand/40"
              >
                <Link href={h.surface} className="block px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-medium">{h.title}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {h.kind}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">score {h.score}</span>
                    </div>
                  </div>
                  {h.snippet && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {h.snippet}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
