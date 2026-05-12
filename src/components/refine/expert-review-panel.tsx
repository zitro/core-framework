import { Bot, Play, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { RefineAgentDefinition } from "@/types/core";
import { agentIcon } from "@/components/refine/expert-review-constants";

interface ExpertPanelProps {
  agents: RefineAgentDefinition[];
  selectedAgentIds: string[];
  runningAgentIds: string[];
  instructions: string;
  error: string | null;
  onInstructionsChange: (value: string) => void;
  onToggleAgent: (agentId: string) => void;
  onRunReview: (agentIds: string[]) => void;
}

export function ExpertPanel({
  agents,
  selectedAgentIds,
  runningAgentIds,
  instructions,
  error,
  onInstructionsChange,
  onToggleAgent,
  onRunReview,
}: ExpertPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-500" />
          Expert Panel
        </CardTitle>
        <CardDescription>
          Run a single advisor for a focused review, or run the full board to compare expert perspectives.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Optional focus for this review, such as integration risk, AI feasibility, adoption, or what must be true before Execute creates final outputs."
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRunReview(selectedAgentIds)} disabled={runningAgentIds.length > 0 || selectedAgentIds.length === 0}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {runningAgentIds.length > 0 ? "Running..." : `Run Selected (${selectedAgentIds.length})`}
          </Button>
          <Button variant="outline" onClick={() => onRunReview(agents.map((agent) => agent.id))} disabled={runningAgentIds.length > 0 || agents.length === 0}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Run Full Board
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((agent) => {
            const Icon = agentIcon[agent.id] ?? Bot;
            const selected = selectedAgentIds.includes(agent.id);
            const runningThis = runningAgentIds.includes(agent.id);
            return (
              <div key={agent.id} className={`rounded-lg border p-4 space-y-3 ${selected ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{agent.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{agent.mission}</p>
                    {agent.goal && <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2 line-clamp-2">Goal: {agent.goal}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.expected_outputs.slice(0, 3).map((output) => (
                    <Badge key={output} variant="outline" className="text-[10px]">{output}</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant={selected ? "default" : "outline"} size="sm" onClick={() => onToggleAgent(agent.id)}>
                    {selected ? "Selected" : "Select"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onRunReview([agent.id])} disabled={runningAgentIds.length > 0}>
                    {runningThis ? "Running..." : "Ask Agent"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
