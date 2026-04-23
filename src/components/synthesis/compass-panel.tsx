"use client";

import { useEffect, useState, useCallback } from "react";
import { Compass, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  synthesisApi,
  type CompassCategoryHealth,
  type CompassHealth,
  type SynthesisCompass,
} from "@/lib/api-synthesis";

interface CompassPanelProps {
  projectId: string;
  /** Bumped by parent when artifacts change so we refetch. */
  refreshKey?: number;
  /** Refresh corpus (and auto-rebuild if enabled) then notify parent. */
  onRefreshSources?: () => Promise<void> | void;
  autoRebuild?: boolean;
  onToggleAutoRebuild?: (enabled: boolean) => Promise<void> | void;
}

export function CompassPanel({
  projectId,
  refreshKey = 0,
  onRefreshSources,
  autoRebuild = false,
  onToggleAutoRebuild,
}: CompassPanelProps) {
  const [data, setData] = useState<SynthesisCompass | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await synthesisApi.compass(projectId);
      setData(res);
    } catch (err) {
      toast.error(`Failed to load compass: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const onRefresh = async () => {
    if (!onRefreshSources) {
      await load();
      return;
    }
    setRefreshing(true);
    try {
      await onRefreshSources();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Compass className="size-4" />
          DT Compass
          {data && (
            <Badge variant={overallVariant(data.overall)} className="text-[10px] uppercase">
              {data.overall}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={onRefresh}
            disabled={busy || refreshing}
            title={onRefreshSources ? "Refresh sources + recompute" : "Recompute"}
          >
            <RefreshCw
              className={`size-3 ${busy || refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data ? (
          <p className="text-xs text-muted-foreground">Computing…</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {data.categories.map((c) => (
              <CategoryDot key={c.category} cat={c} />
            ))}
          </div>
        )}
        {onToggleAutoRebuild && (
          <label className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRebuild}
              onChange={(e) => void onToggleAutoRebuild(e.target.checked)}
              className="size-3"
            />
            <Wand2 className="size-3" />
            Auto-rebuild stale artifacts when sources refresh
          </label>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryDot({ cat }: { cat: CompassCategoryHealth }) {
  const tone = healthTone(cat.health);
  const detail =
    cat.critical_missing > 0
      ? `${cat.critical_missing} critical missing`
      : cat.blocker_signals > 0
        ? `${cat.blocker_signals} blocker`
        : cat.warn_signals > 0
          ? `${cat.warn_signals} warn`
          : `${cat.present} ready`;

  return (
    <div
      className={`min-w-0 rounded-md border p-2 ${tone.bg}`}
      title={`${cat.label}: present=${cat.present} draft=${cat.draft} missing=${cat.critical_missing} blocker=${cat.blocker_signals} warn=${cat.warn_signals}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${tone.dot}`} />
        <span className="min-w-0 truncate text-xs font-medium">{cat.label}</span>
      </div>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{detail}</p>
    </div>
  );
}

function overallVariant(h: CompassHealth): "default" | "secondary" | "destructive" {
  switch (h) {
    case "red":
      return "destructive";
    case "amber":
      return "secondary";
    default:
      return "default";
  }
}

function healthTone(h: CompassHealth): { bg: string; dot: string } {
  switch (h) {
    case "red":
      return { bg: "bg-rose-50 border-rose-200", dot: "bg-rose-500" };
    case "amber":
      return { bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" };
    default:
      return { bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  }
}
