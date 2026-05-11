"use client";

/**
 * SignalsPanel — deterministic blocker/warn/info badges over the
 * synthesis state. Source endpoint is a pure aggregate (no LLM), so
 * loading on mount is safe; the per-signal "regenerate" action is the
 * only LLM trigger and stays user-driven.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Info,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { synthesisApi } from "@/lib/api-synthesis";
import type {
  SynthesisSignal,
  SynthesisSignalSeverity,
  SynthesisSignalsResponse,
} from "@/types/synthesis";

interface SignalsPanelProps {
  projectId: string;
  /** Called when the user requests a regenerate; parent owns the action. */
  onRegenerate: (typeId: string) => Promise<void> | void;
  /** Increment to force a refetch after parent state changes. */
  refreshKey?: number;
}

export function SignalsPanel({
  projectId,
  onRegenerate,
  refreshKey = 0,
}: SignalsPanelProps) {
  const [data, setData] = useState<SynthesisSignalsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await synthesisApi.signals(projectId);
      setData(res);
    } catch (err) {
      toast.error(`Failed to load signals: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const onAct = async (sig: SynthesisSignal) => {
    if (sig.action !== "regenerate" || !sig.artifact_type_id) return;
    setActingId(sig.id);
    try {
      await onRegenerate(sig.artifact_type_id);
      await load();
    } finally {
      setActingId(null);
    }
  };

  const counts = data?.counts ?? { info: 0, warn: 0, blocker: 0 };
  const total = (data?.signals ?? []).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2 text-sm">
          <Sparkles className="size-4" aria-hidden />
          Signals
          {total > 0 && (
            <span className="ml-auto flex items-center gap-1">
              {counts.blocker > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {counts.blocker} blocker
                </Badge>
              )}
              {counts.warn > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {counts.warn} warn
                </Badge>
              )}
              {counts.info > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {counts.info} info
                </Badge>
              )}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => void load()}
            disabled={busy}
            aria-label="Refresh signals"
          >
            <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data ? (
          <p className="text-xs text-muted-foreground">Scanning…</p>
        ) : total === 0 ? (
          <p className="text-xs text-muted-foreground">
            No signals. Synthesis is healthy and grounded.
          </p>
        ) : (
          data.signals.map((sig) => (
            <SignalRow
              key={sig.id}
              signal={sig}
              onAct={onAct}
              busy={actingId === sig.id}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SignalRow({
  signal,
  onAct,
  busy,
}: {
  signal: SynthesisSignal;
  onAct: (sig: SynthesisSignal) => Promise<void> | void;
  busy: boolean;
}) {
  const canAct =
    signal.action === "regenerate" && !!signal.artifact_type_id;

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2">
      <div className="flex items-start gap-2">
        <SeverityIcon severity={signal.severity} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-medium">{signal.title}</p>
          <p className="text-[11px] text-muted-foreground">{signal.message}</p>
          {signal.artifact_type_id && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <code>{signal.kind}</code> ·{" "}
              <code>{signal.artifact_type_id}</code>
            </p>
          )}
          {canAct && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => void onAct(signal)}
              disabled={busy}
            >
              {busy ? "…" : "Regenerate"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: SynthesisSignalSeverity }) {
  const className = "size-4 mt-0.5 shrink-0";
  // Severity icons are a status channel; we keep restrained tints so
  // they read at a glance without inviting wider palette use.
  switch (severity) {
    case "blocker":
      return (
        <ShieldAlert
          className={`${className} text-destructive`}
          aria-label="blocker"
        />
      );
    case "warn":
      return (
        <AlertTriangle
          className={`${className} text-amber-600 dark:text-amber-400`}
          aria-label="warn"
        />
      );
    default:
      return (
        <Info
          className={`${className} text-muted-foreground`}
          aria-label="info"
        />
      );
  }
}
