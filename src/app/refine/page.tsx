"use client";

import { useCallback, useState } from "react";
import { Target, Users, Cpu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Assumption, Discovery } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { AssumptionTracker } from "@/components/refine/assumption-tracker";
import { ExpertReviewWorkshop } from "@/components/refine/expert-review-workshop";
import { SolutionArchitect } from "@/components/refine/solution-architect";
import { PhaseShell } from "@/components/layout/phase-shell";
import { DiscoveryRequired } from "@/components/layout/discovery-required";
import { AiFeedback } from "@/components/orchestrate/ai-feedback";
import { useTabParam } from "@/lib/use-tab-param";

export default function RefinePage() {
  const { activeDiscovery } = useDiscovery();

  if (!activeDiscovery) {
    return <DiscoveryRequired phase="refine" />;
  }

  return <RefineWorkspace key={activeDiscovery.id} activeDiscovery={activeDiscovery} />;
}

function RefineWorkspace({ activeDiscovery }: { activeDiscovery: Discovery }) {
  const discoveryId = activeDiscovery.id;
  const [activeTab, setActiveTab] = useTabParam("experts");
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList variant="line" className="gap-3 border-b">
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
          <AiFeedback discoveryId={discoveryId} surface="expert_review" />
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
          <AiFeedback discoveryId={discoveryId} surface="blueprint" />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
