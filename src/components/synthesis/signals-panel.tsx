"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Info, ShieldAlert, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  synthesisApi,
  type SynthesisSignal,
  type SynthesisSignalSeverity,
  type SynthesisSignalsResponse,
} from "@/lib/api-synthesis";

interface SignalsPanelProps {
  projectId: string;
  /** Called when the user requests a regenerate; parent owns the action. */
  onRegenerate: (typeId: string) => Promise<void> | void;
  /** Increment to force a refetch after parent state changes. */
  refreshKey?: number;
}

export function SignalsPanel({ projectId, onRegenerate, refreshKey = 0 }: SignalsPanelProps) {
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
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4" />
          Signals
          {total > 0 && (
            <span className="ml-auto flex items-center gap-1">
              {counts.blocker > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {counts.blocker} blocker
                </Badge>
              )}
              {counts.warn > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px]">
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
  const canAct = signal.action === "regenerate" && !!signal.artifact_type_id;

  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-start gap-2">
        <SeverityIcon severity={signal.severity} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-medium">{signal.title}</p>
          <p className="text-[11px] text-muted-foreground">{signal.message}</p>
          {signal.artifact_type_id && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <code>{signal.kind}</code> · <code>{signal.artifact_type_id}</code>
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
  switch (severity) {
    case "blocker":
      return <ShieldAlert className={`${className} text-rose-600`} />;
    case "warn":
      return <AlertTriangle className={`${className} text-amber-600`} />;
    default:
      return <Info className={`${className} text-sky-600`} />;
  }
}
