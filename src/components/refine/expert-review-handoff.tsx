import { PanelTop } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  Assumption,
  ContextBriefVersion,
  Discovery,
  RefineReview,
  UseCaseVersion,
} from "@/types/core";

interface OrchestrateHandoffProps {
  activeDiscovery: Discovery;
  assumptions: Assumption[];
  latestBrief: ContextBriefVersion | null;
  latestUseCase: UseCaseVersion | null;
  latestReview: RefineReview | null;
}

export function OrchestrateHandoff({
  activeDiscovery,
  assumptions,
  latestBrief,
  latestUseCase,
  latestReview,
}: OrchestrateHandoffProps) {
  const problemStatement = activeDiscovery.problem_statement?.statement || "No problem statement has been sent forward yet.";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PanelTop className="h-4 w-4 text-emerald-500" />
          Orchestrate Handoff
        </CardTitle>
        <CardDescription>
          The expert panel reviews the current understanding, problem, use case, evidence, and unresolved risks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Problem</p>
            <p className="text-sm line-clamp-5">{problemStatement}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Project Understanding</p>
            <p className="text-sm line-clamp-5">{latestBrief?.summary || activeDiscovery.description || "No project understanding has been generated yet."}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Use Case</p>
            <p className="text-sm font-medium">{latestUseCase?.title || "No use case draft yet"}</p>
            {latestUseCase && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{latestUseCase.summary}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{activeDiscovery.evidence?.length ?? 0} evidence items</Badge>
          <Badge variant="secondary">{assumptions.length} tracked assumptions</Badge>
          <Badge variant="secondary">{latestReview ? `${latestReview.opinions.length} latest agent opinions` : "No expert review yet"}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
