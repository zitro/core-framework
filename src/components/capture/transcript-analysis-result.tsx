import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Evidence } from "@/types/core";
import { ConfidenceBadge } from "./confidence-badge";

export type AnalysisSummary = {
  insights: { text: string; confidence: string }[];
  key_themes: string[];
  sentiment: string;
};

export function TranscriptAnalysisResult({
  result,
  extractedEvidence,
}: {
  result: AnalysisSummary;
  extractedEvidence: Evidence[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analysis Results</CardTitle>
        <div className="flex gap-2 mt-1">
          <Badge variant="outline">Sentiment: {result.sentiment}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Key Themes</h4>
          <div className="flex flex-wrap gap-1.5">
            {result.key_themes.map((theme, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {theme}
              </Badge>
            ))}
          </div>
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium mb-2">Insights</h4>
          <div className="space-y-2">
            {result.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded border">
                <ConfidenceBadge value={insight.confidence} />
                <p className="text-sm">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
        {extractedEvidence.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">
                Evidence Saved
                <Badge variant="secondary" className="ml-2">
                  {extractedEvidence.length}
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                Auto-extracted from transcript and saved to the Evidence Board.
              </p>
              <div className="space-y-1">
                {extractedEvidence.map((ev) => (
                  <div key={ev.id} className="text-xs p-2 rounded border bg-blue-500/5">
                    {ev.content}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
