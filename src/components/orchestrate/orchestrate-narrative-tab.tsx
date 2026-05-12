"use client";

import { AiFeedback } from "@/components/orchestrate/ai-feedback";
import { NarrativePanel } from "@/components/orchestrate/narrative-panel";
import type { Discovery } from "@/types/core";

type Props = {
  discoveryId: string;
  activeDiscovery: Discovery;
};

export function OrchestrateNarrativeTab({ discoveryId, activeDiscovery }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        The discovery as a continuous story. Audience, style, and focus shape the same source material —
        regenerate any time the underlying evidence changes.
      </p>
      <NarrativePanel discovery={activeDiscovery} />
      <AiFeedback discoveryId={discoveryId} surface="narrative" />
    </div>
  );
}
