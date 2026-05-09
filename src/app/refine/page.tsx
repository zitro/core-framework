"use client";

import { useCallback, useState } from "react";
import { FlaskConical, Target, Users, Cpu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Assumption, Discovery } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { AssumptionTracker } from "@/components/refine/assumption-tracker";
import { ExpertReviewWorkshop } from "@/components/refine/expert-review-workshop";
import { SolutionArchitect } from "@/components/refine/solution-architect";
import { PhaseShell } from "@/components/layout/phase-shell";

export default function RefinePage() {
  const { activeDiscovery } = useDiscovery();

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <FlaskConical className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Select or create a discovery from the Dashboard to start refining.</p>
      </div>
    );
  }

  return <RefineWorkspace key={activeDiscovery.id} activeDiscovery={activeDiscovery} />;
}

function RefineWorkspace({ activeDiscovery }: { activeDiscovery: Discovery }) {
  const discoveryId = activeDiscovery.id;
  const [assumptions, setAssumptions] = useState<Assumption[]>(activeDiscovery.assumptions || []);

  const persistAssumptions = useCallback(
    async (updated: Assumption[]) => {
      if (!discoveryId) return;
      try {
        await api.discoveries.update(discoveryId, { assumptions: updated } as Partial<Discovery>);
      } catch { /* non-critical */ }
    },
    [discoveryId]
  );

  const handleAssumptionsChange = (updated: Assumption[]) => {
    setAssumptions(updated);
    persistAssumptions(updated);
  };

  const handleAddAssumptions = (items: Assumption[]) => {
    const updated = [...assumptions, ...items];
    handleAssumptionsChange(updated);
  };

  return (
    <PhaseShell
      phase="refine"
      discoveryId={discoveryId}
      showEvidencePanel={false}
      showDtMethodsPanel={false}
    >
      <Tabs defaultValue="experts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="experts" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Expert Review
          </TabsTrigger>
          <TabsTrigger value="assumptions" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Validation
          </TabsTrigger>
          <TabsTrigger value="architect" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Blueprint Candidate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="experts" className="space-y-4">
          <ExpertReviewWorkshop
            discoveryId={discoveryId}
            activeDiscovery={activeDiscovery}
            assumptions={assumptions}
            onAddAssumptions={handleAddAssumptions}
          />
        </TabsContent>

        <TabsContent value="assumptions" className="space-y-4">
          <AssumptionTracker
            assumptions={assumptions}
            onAssumptionsChange={handleAssumptionsChange}
          />
        </TabsContent>

        <TabsContent value="architect" className="space-y-4">
          <SolutionArchitect
            discoveryId={discoveryId}
            providers={activeDiscovery?.solution_providers || []}
          />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
