"use client";

/**
 * VertexWriteBackToggle — flips the per-project engagement-repo write
 * flag. The backing endpoint (PUT /settings/engagement-repo) is on the
 * Phase 6J shortlist; until it lands the toggle stays disabled with a
 * "coming soon" hint so the UI is wired up but inert.
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
  /** Set true while the Phase 6J backend endpoint isn't shipped yet. */
  comingSoon?: boolean;
}

export function VertexWriteBackToggle({
  projectId,
  enabled,
  onChange,
  comingSoon = false,
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
      disabled={busy || comingSoon}
      title={
        comingSoon
          ? "Engagement-repo write-back ships in Phase 6J"
          : enabled
            ? "Disable engagement-repo write-back"
            : "Enable engagement-repo write-back"
      }
    >
      {busy ? (
        <Loader2 className="size-4 mr-2 animate-spin" />
      ) : enabled ? (
        <ToggleRight className="size-4 mr-2 text-foreground" aria-hidden />
      ) : (
        <ToggleLeft
          className="size-4 mr-2 text-muted-foreground"
          aria-hidden
        />
      )}
      Engagement-repo {comingSoon ? "soon" : enabled ? "ON" : "OFF"}
    </Button>
  );
}
