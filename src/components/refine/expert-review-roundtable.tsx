import { MessageSquareText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RefineReview } from "@/types/core";
import { roundtablePhaseLabel } from "@/components/refine/expert-review-constants";

export function Roundtable({ review }: { review: RefineReview }) {
  if (review.roundtable.length === 0) return null;
  const phases = Object.keys(roundtablePhaseLabel);
  const grouped = phases.map((phase) => ({
    phase,
    turns: review.roundtable.filter((turn) => turn.phase === phase),
  })).filter((group) => group.turns.length > 0);
  const fallbackTurns = review.roundtable.filter((turn) => !turn.phase || !roundtablePhaseLabel[turn.phase]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-emerald-500" />
          Agent Roundtable
        </CardTitle>
        <CardDescription>Visible expert discussion, disagreement, and decision impact.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(grouped.length > 0 ? grouped : [{ phase: "discussion", turns: fallbackTurns }]).map((group) => (
          <div key={group.phase} className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {roundtablePhaseLabel[group.phase] || "Discussion"}
            </p>
            {group.turns.map((turn, index) => (
              <div key={`${turn.speaker_id}-${index}`} className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{turn.speaker}</Badge>
                  {turn.responds_to && <span className="text-xs text-muted-foreground">responding to {turn.responds_to}</span>}
                </div>
                <p className="text-sm">{turn.message}</p>
                {turn.decision_impact && <p className="text-xs text-emerald-700 dark:text-emerald-400">Decision impact: {turn.decision_impact}</p>}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
