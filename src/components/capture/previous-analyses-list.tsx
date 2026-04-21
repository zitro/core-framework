import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptAnalysis } from "@/types/core";
import { ConfidenceBadge } from "./confidence-badge";

const MAX_INSIGHTS_PREVIEW = 3;

export function PreviousAnalysesList({ analyses }: { analyses: TranscriptAnalysis[] }) {
  if (analyses.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Previous Analyses
          <Badge variant="secondary" className="ml-2">
            {analyses.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Saved transcript analyses for this discovery. Evidence is already on the Evidence Board.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {[...analyses].reverse().map((a) => (
              <div key={a.id} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {a.sentiment}
                    </Badge>
                    {a.key_themes.slice(0, 3).map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{a.transcript_text}</p>
                {a.insights.length > 0 && (
                  <div className="space-y-1">
                    {a.insights.slice(0, MAX_INSIGHTS_PREVIEW).map((ins, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <ConfidenceBadge value={ins.confidence} className="text-[9px]" />
                        <p className="text-xs">{ins.text}</p>
                      </div>
                    ))}
                    {a.insights.length > MAX_INSIGHTS_PREVIEW && (
                      <p className="text-[10px] text-muted-foreground">
                        +{a.insights.length - MAX_INSIGHTS_PREVIEW} more insights
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
