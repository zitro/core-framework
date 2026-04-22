"use client";

import { useCallback, useEffect, useState } from "react";
import { Plug, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { synthesisApi, type SynthesisConnector } from "@/lib/api-synthesis";

interface ConnectorsPanelProps {
  projectId: string;
  /** Current per-project source config keyed by connector kind. */
  initialSources?: Record<string, unknown>;
  /** Called after a successful save so parent can refresh state. */
  onSaved?: (sources: Record<string, unknown>) => void;
}

const SAMPLE_CONFIG: Record<string, string> = {
  github: JSON.stringify(
    { repos: [{ owner: "CUSTOMER", repo: "REPO", paths: ["docs/"] }] },
    null,
    2,
  ),
  web: JSON.stringify(
    { urls: ["https://customer.com/roadmap"] },
    null,
    2,
  ),
  http_json: JSON.stringify(
    {
      endpoints: [
        {
          url: "https://api.customer.com/issues",
          items_path: "issues",
          id_field: "key",
          title_field: "summary",
          text_field: "description",
        },
      ],
    },
    null,
    2,
  ),
};

export function ConnectorsPanel({
  projectId,
  initialSources = {},
  onSaved,
}: ConnectorsPanelProps) {
  const [registry, setRegistry] = useState<SynthesisConnector[]>([]);
  const [sources, setSources] = useState<Record<string, unknown>>(initialSources);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await synthesisApi.connectors();
        if (!cancelled) setRegistry(res.connectors);
      } catch (err) {
        toast.error("Failed to load connectors", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync external `initialSources` only when its contents actually change.
  // Comparing the prop reference would loop forever because callers often
  // pass an inline `{}` default, which is a fresh object on every render.
  const initialSourcesKey = JSON.stringify(initialSources ?? {});
  useEffect(() => {
    setSources(initialSources ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSourcesKey]);

  const draftFor = useCallback(
    (kind: string) => {
      if (drafts[kind] !== undefined) return drafts[kind];
      const existing = sources[kind];
      if (existing) return JSON.stringify(existing, null, 2);
      return SAMPLE_CONFIG[kind] ?? "{}";
    },
    [drafts, sources],
  );

  async function save(kind: string) {
    const raw = draftFor(kind);
    let parsed: Record<string, unknown>;
    try {
      parsed = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      toast.error("Invalid JSON", {
        description: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    setSaving(kind);
    try {
      const res = await synthesisApi.updateConnectorConfig(projectId, kind, parsed);
      setSources(res.sources);
      setDrafts((d) => {
        const next = { ...d };
        delete next[kind];
        return next;
      });
      toast.success(`${kind} connector saved`);
      onSaved?.(res.sources);
    } catch (err) {
      toast.error("Failed to save connector", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(null);
    }
  }

  async function clear(kind: string) {
    setSaving(kind);
    try {
      const res = await synthesisApi.updateConnectorConfig(projectId, kind, {});
      setSources(res.sources);
      setDrafts((d) => {
        const next = { ...d };
        delete next[kind];
        return next;
      });
      toast.success(`${kind} connector cleared`);
      onSaved?.(res.sources);
    } catch (err) {
      toast.error("Failed to clear connector", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4" /> Source connectors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading connectors…</p>
        </CardContent>
      </Card>
    );
  }

  const configurable = registry.filter((c) => !c.builtin);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-4 w-4" /> Source connectors
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {configurable.length === 0 ? (
          <p className="text-sm text-muted-foreground">No optional connectors available.</p>
        ) : (
          configurable.map((c) => {
            const configured = Boolean(sources[c.kind]);
            return (
              <div key={c.kind} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {c.label}
                      {configured && (
                        <Badge variant="secondary" className="text-xs">
                          configured
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                </div>
                <textarea
                  className="w-full font-mono text-xs border rounded p-2 min-h-[120px] bg-muted/30"
                  value={draftFor(c.kind)}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [c.kind]: e.target.value }))
                  }
                  spellCheck={false}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => save(c.kind)}
                    disabled={saving === c.kind}
                  >
                    <Save className="h-3 w-3 mr-1" /> Save
                  </Button>
                  {configured && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => clear(c.kind)}
                      disabled={saving === c.kind}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
