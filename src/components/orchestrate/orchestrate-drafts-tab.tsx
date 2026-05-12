"use client";

import { Briefcase, Route } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiFeedback } from "@/components/orchestrate/ai-feedback";
import { ProblemStatementBuilder } from "@/components/orchestrate/problem-statement-builder";
import { UseCaseBuilder } from "@/components/orchestrate/use-case-builder";
import type { Discovery } from "@/types/core";

type Props = {
  discoveryId: string;
  activeDiscovery: Discovery;
};

export function OrchestrateDraftsTab({ discoveryId, activeDiscovery }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Working synthesis drafts. Refine is where final statements get hardened.
      </p>
      <Tabs defaultValue="problem" className="space-y-4">
        <TabsList variant="line" className="gap-3 border-b">
          <TabsTrigger value="problem" className="gap-1.5">
            <Route className="h-3.5 w-3.5" />
            Problem Frame
          </TabsTrigger>
          <TabsTrigger value="usecase" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Use Case
          </TabsTrigger>
        </TabsList>
        <TabsContent value="problem" className="space-y-4">
          <ProblemStatementBuilder discoveryId={discoveryId} activeDiscovery={activeDiscovery} />
          <AiFeedback discoveryId={discoveryId} surface="problem" />
        </TabsContent>
        <TabsContent value="usecase" className="space-y-4">
          <UseCaseBuilder discoveryId={discoveryId} />
          <AiFeedback discoveryId={discoveryId} surface="usecase" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
