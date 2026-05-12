import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import type { RefineReview } from "@/types/core";
import { gateLabel } from "@/components/refine/expert-review-constants";
import { ListBlock } from "@/components/refine/expert-review-list-block";

export function ReviewSynthesis({ review }: { review: RefineReview }) {
  const synthesis = review.synthesis;
  return (
    <Card className="border-emerald-500/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Expert Synthesis v{review.version || 1}
            </CardTitle>
            <CardDescription>
              {new Date(review.created_at).toLocaleString()}
              {review.trigger_source && ` · ${review.trigger_source.replace("_", " ")}`}
              {review.parent_review_id && " · builds on prior version"}
            </CardDescription>
          </div>
          <Badge variant="outline">{gateLabel[synthesis.decision_gate] || synthesis.decision_gate}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Recommended Direction</p>
          <p className="text-sm whitespace-pre-line">{synthesis.recommended_direction || "No recommendation returned."}</p>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Expert confidence</span>
            <span className="font-medium">{synthesis.confidence}%</span>
          </div>
          <Progress value={synthesis.confidence} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ListBlock title="Consensus" items={synthesis.consensus} />
          <ListBlock title="Disagreements" items={synthesis.disagreements} />
        </div>
        <Separator />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Solution Options</p>
          <div className="grid gap-3 md:grid-cols-2">
            {synthesis.solution_options.map((option) => (
              <div key={option.title} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{option.title}</p>
                  <Badge variant="secondary" className="text-[10px]">{option.effort}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{option.value}</p>
                <p className="text-xs"><span className="font-medium">Risk:</span> {option.risk}</p>
                <p className="text-xs"><span className="font-medium">Evidence fit:</span> {option.evidence_fit}</p>
                {option.tradeoffs.length > 0 && <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">{option.tradeoffs.map((item) => <li key={item}>{item}</li>)}</ul>}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ListBlock title="Validation Plan" items={synthesis.validation_plan} />
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Execute Readiness</p>
            <p className="text-sm">{synthesis.execute_readiness || "No readiness note returned."}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
