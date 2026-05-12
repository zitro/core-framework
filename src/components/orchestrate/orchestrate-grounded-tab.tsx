"use client";

import { AiFeedback } from "@/components/orchestrate/ai-feedback";
import { GroundedPanel } from "@/components/orchestrate/grounded-panel";

type Props = {
  discoveryId: string;
};

export function OrchestrateGroundedTab({ discoveryId }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Ask a question and get a grounded answer with inline citations, pulled from M365 search.
      </p>
      <GroundedPanel discoveryId={discoveryId} />
      <AiFeedback discoveryId={discoveryId} surface="grounded" />
    </div>
  );
}
