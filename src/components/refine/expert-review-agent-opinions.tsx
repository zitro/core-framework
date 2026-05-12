import { Bot } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { RefineAgentOpinion } from "@/types/core";
import { agentIcon } from "@/components/refine/expert-review-constants";
import { ListBlock } from "@/components/refine/expert-review-list-block";

export function AgentOpinions({ opinions }: { opinions: RefineAgentOpinion[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {opinions.map((opinion) => {
        const Icon = agentIcon[opinion.agent_id] ?? Bot;
        return (
          <Card key={`${opinion.agent_id}-${opinion.title}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4 text-emerald-500" />
                {opinion.role || opinion.agent_id}
              </CardTitle>
              <CardDescription>{opinion.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-line">{opinion.position}</p>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Role confidence</span>
                  <span className="font-medium">{opinion.confidence}%</span>
                </div>
                <Progress value={opinion.confidence} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ListBlock title="Strengths" items={opinion.strengths} />
                <ListBlock title="Concerns" items={opinion.concerns} />
                <ListBlock title="Risks" items={opinion.risks} />
                <ListBlock title="Recommendations" items={opinion.recommendations} />
              </div>
              {opinion.work_items.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Role Work Items</p>
                  <div className="space-y-2">
                    {opinion.work_items.map((item) => (
                      <div key={`${item.title}-${item.owner_role}`} className="rounded-md bg-muted/30 p-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          <Badge variant="outline" className="text-[10px]">{item.priority}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Owner: {item.owner_role || opinion.role}</p>
                        {item.rationale && <p className="mt-1 text-xs">{item.rationale}</p>}
                        {item.next_step && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Next: {item.next_step}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(opinion.artifact?.content || opinion.artifact?.bullets?.length > 0) && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium">{opinion.artifact.title || "Working artifact"}</p>
                  {opinion.artifact.content && <p className="text-sm whitespace-pre-line">{opinion.artifact.content}</p>}
                  {opinion.artifact.bullets.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {opinion.artifact.bullets.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              )}
              <ListBlock title="Questions" items={opinion.questions} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
