"use client";

/**
 * MethodInstancesPanel — list of saved instances for one methodology
 * method, with controls to add a new instance manually or auto-generate
 * from the discovery corpus. Used by:
 *   - the Methodology page (one panel per multi-instance method)
 *   - the Orchestrate "Personas" tab (focused on persona instances)
 *
 * Reads from and writes to the shared ``methodology_artifacts`` store,
 * so anything generated or edited here also shows up on the other
 * surface and feeds every CORE synthesis prompt.
 */

import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TemplateModal } from "@/components/methodology/template-modal";
import { methodologyApi, type MethodologyArtifact } from "@/lib/api-methodology";
import {
  getTemplateFields,
  supportsAutogen,
  type DtMethod,
  type FdeMethod,
} from "@/lib/dt-methods";

type Method = (DtMethod | FdeMethod) & { template?: string };

interface Props {
  method: Method;
  discoveryId: string | undefined;
  /** Pass an external instance list to control loading externally;
   *  otherwise the panel loads its own list on mount. */
  instances?: MethodologyArtifact[];
  onInstancesChange?: (next: MethodologyArtifact[]) => void;
}

export function MethodInstancesPanel({
  method,
  discoveryId,
  instances: external,
  onInstancesChange,
}: Props) {
  const templateId = method.template;
  const fieldDefs = templateId ? getTemplateFields(templateId) : [];
  const autogen = supportsAutogen(templateId);

  const [internal, setInternal] = useState<MethodologyArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MethodologyArtifact | null>(null);
  const [creating, setCreating] = useState(false);

  const instances = external ?? internal;
  const controlled = external !== undefined;

  useEffect(() => {
    if (controlled || !discoveryId || !templateId) {
      if (controlled) return;
      setInternal([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    methodologyApi
      .list(discoveryId, templateId)
      .then((rows) => {
        if (!cancelled) setInternal(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load instances");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [controlled, discoveryId, templateId]);

  const refresh = async () => {
    if (!discoveryId || !templateId) return;
    const rows = await methodologyApi.list(discoveryId, templateId);
    if (controlled) {
      onInstancesChange?.(rows);
    } else {
      setInternal(rows);
    }
  };

  const handleGenerate = async () => {
    if (!discoveryId || !templateId) return;
    setGenerating(true);
    setError(null);
    try {
      await methodologyApi.generate(templateId, { discovery_id: discoveryId, count: 3 });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate from corpus");
    } finally {
      setGenerating(false);
    }
  };

  if (!discoveryId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a discovery to capture or generate {method.name.toLowerCase()} instances.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {autogen && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={handleGenerate}
            disabled={generating || loading}
            className="gap-1.5"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" aria-hidden />
                Generate from your discovery
              </>
            )}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setCreating(true)}
          disabled={generating}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add manually
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : instances.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {autogen
            ? "No instances yet. Generate from your discovery, or add one manually."
            : "No instances yet. Add one to get started."}
        </p>
      ) : (
        <ul className="space-y-2">
          {instances.map((row) => (
            <li
              key={row.id}
              className="group cursor-pointer rounded-md border bg-card px-3 py-2.5 transition-colors hover:border-brand/40"
              onClick={() => setEditing(row)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium">
                      {row.title || "Untitled"}
                    </p>
                    {row.source === "auto" && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] font-medium text-muted-foreground"
                      >
                        <Sparkles className="h-2.5 w-2.5" aria-hidden />
                        Auto
                      </Badge>
                    )}
                  </div>
                  <InstancePreview fields={row.fields} fieldOrder={fieldDefs.map((f) => f.id)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplateModal
        open={Boolean(editing) || creating}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(false);
          }
        }}
        method={method}
        discoveryId={discoveryId}
        existing={editing}
        onSaved={refresh}
      />
    </div>
  );
}

function InstancePreview({
  fields,
  fieldOrder,
}: {
  fields: Record<string, string>;
  fieldOrder: string[];
}) {
  const summary = fieldOrder
    .map((k) => (fields[k] || "").trim())
    .filter(Boolean)
    .join(" · ");
  if (!summary) return null;
  return <p className="line-clamp-2 text-xs text-muted-foreground">{summary}</p>;
}
