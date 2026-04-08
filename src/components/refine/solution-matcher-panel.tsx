"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { SolutionMatch } from "@/types/core";

interface SolutionMatcherPanelProps {
  problemInput: string;
  onProblemChange: (value: string) => void;
  capabilitiesInput: string;
  onCapabilitiesChange: (value: string) => void;
  matches: SolutionMatch[];
  matching: boolean;
  onMatch: () => void;
}

export function SolutionMatcherPanel({
  problemInput,
  onProblemChange,
  capabilitiesInput,
  onCapabilitiesChange,
  matches,
  matching,
  onMatch,
}: SolutionMatcherPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solution Matcher</CardTitle>
        <CardDescription>
          Bridge &quot;we understand the problem&quot; to &quot;here&apos;s what solves it.&quot;
          Map problems to existing capabilities and identify gaps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Problem to solve</label>
          <Textarea value={problemInput} onChange={(e) => onProblemChange(e.target.value)}
            placeholder="e.g., Portfolio managers need real-time visibility into exposure across 3 asset classes"
            rows={2} />
        </div>
        <div>
          <label className="text-sm font-medium">Known capabilities (comma-separated)</label>
          <Textarea value={capabilitiesInput} onChange={(e) => onCapabilitiesChange(e.target.value)}
            placeholder="e.g., Bloomberg terminal, Refinitiv feeds, Power BI dashboards, custom risk engine"
            rows={2} />
        </div>
        <Button onClick={onMatch} disabled={matching}>
          {matching ? "Matching..." : "Find Solution Matches"}
        </Button>

        {matches.length > 0 && (
          <>
            <Separator />
            {matches.map((m, i) => (
              <Card key={i} className="border-emerald-500/20">
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Problem</p>
                    <p className="text-sm font-medium">{m.problem}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Matched Capabilities</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {m.capabilities.map((c, j) => (
                        <Badge key={j} variant="secondary">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Gap</p>
                    <p className="text-sm text-amber-600">{m.gap}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Confidence</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${m.confidence}%` }} />
                      </div>
                      <span className="text-xs font-medium">{m.confidence}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
