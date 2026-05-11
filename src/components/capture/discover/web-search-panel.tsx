"use client";

/**
 * WebSearchPanel — pull external web context into discovery.
 *
 * Purpose: ad-hoc web search to find URLs you don't have yet. Results
 * are ephemeral; users copy useful snippets into Capture's Context tab
 * (URL capture type) to persist them.
 */

import { useState } from "react";
import { ExternalLink, Globe, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/layout/empty-state";
import { api } from "@/lib/api";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export function WebSearchPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [provider, setProvider] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.search(query.trim(), 10);
      setResults(res.results);
      setEnabled(res.enabled);
      if (res.results[0]?.source) setProvider(res.results[0].source);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          placeholder="Search the web…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {enabled === false && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Web search provider is disabled. Set <code className="font-mono">SEARCH_PROVIDER</code> in
          the backend to <code className="font-mono">duckduckgo</code> or{" "}
          <code className="font-mono">bing</code> to enable.
        </p>
      )}

      {enabled !== false && !loading && results.length === 0 && (
        <EmptyState
          icon={Globe}
          title="Search the web for context"
          description="Pull external sources into your discovery. Results never auto-attach to evidence — paste useful snippets into Capture yourself."
        />
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {provider && (
              <Badge variant="outline" className="text-[10px]">
                {provider}
              </Badge>
            )}
            <span>
              {results.length} result{results.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="space-y-2.5">
            {results.map((r) => (
              <li
                key={r.url}
                className="border-l-2 border-muted py-0.5 pl-3 transition-colors hover:border-brand/60"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium hover:text-brand hover:underline"
                >
                  {r.title}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="truncate text-[10px] text-muted-foreground">{r.url}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {r.snippet}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
