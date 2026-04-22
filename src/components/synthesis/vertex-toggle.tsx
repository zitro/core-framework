"use client";

import { useState } from "react";
import { ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { synthesisApi } from "@/lib/api-synthesis";

interface VertexToggleProps {
  projectId: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function VertexWriteBackToggle({ projectId, enabled, onChange }: VertexToggleProps) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const next = !enabled;
      const res = await synthesisApi.updateVertexSettings(projectId, {
        write_enabled: next,
      });
      const newEnabled = !!res.engagement-repo.write_enabled;
      onChange(newEnabled);
      toast.success(
        newEnabled ? "EngagementRepo write-back enabled" : "EngagementRepo write-back disabled",
      );
    } catch (err) {
      toast.error(`Failed to toggle: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      title={enabled ? "Disable engagement-repo write-back" : "Enable engagement-repo write-back"}
    >
      {busy ? (
        <Loader2 className="size-4 mr-2 animate-spin" />
      ) : enabled ? (
        <ToggleRight className="size-4 mr-2 text-emerald-600" />
      ) : (
        <ToggleLeft className="size-4 mr-2 text-muted-foreground" />
      )}
      EngagementRepo {enabled ? "ON" : "OFF"}
    </Button>
  );
}
