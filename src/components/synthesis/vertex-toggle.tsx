"use client";

/**
 * VertexWriteBackToggle — flips the per-project engagement-repo write
 * flag. Backed by PUT /api/synthesis/{projectId}/settings/engagement-repo.
 */

import { useState } from "react";
import { Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { synthesisApi } from "@/lib/api-synthesis";

interface VertexToggleProps {
  projectId: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function VertexWriteBackToggle({
  projectId,
  enabled,
  onChange,
}: VertexToggleProps) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const next = !enabled;
      const res = await synthesisApi.updateVertexSettings(projectId, {
        write_enabled: next,
      });
      const newEnabled = !!res["engagement-repo"].write_enabled;
      onChange(newEnabled);
      toast.success(
        newEnabled
          ? "Engagement-repo write-back enabled"
          : "Engagement-repo write-back disabled",
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
        <ToggleRight className="size-4 mr-2 text-foreground" aria-hidden />
      ) : (
        <ToggleLeft className="size-4 mr-2 text-muted-foreground" aria-hidden />
      )}
      Engagement-repo {enabled ? "ON" : "OFF"}
    </Button>
  );
}
