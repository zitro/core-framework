"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex gap-2">
            <Input
              placeholder="Search the web…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {enabled === false && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Web search provider is disabled. Set <code>SEARCH_PROVIDER</code> in the backend
            environment to <code>duckduckgo</code> or <code>bing</code> to enable.
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {provider && (
            <div className="text-xs text-muted-foreground">
              <Badge variant="outline">{provider}</Badge> · {results.length} results
            </div>
          )}
          {results.map((r) => (
            <Card key={r.url}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {r.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardTitle>
                <p className="truncate text-xs text-muted-foreground">{r.url}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{r.snippet}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
