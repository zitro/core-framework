"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Evidence, TranscriptAnalysis } from "@/types/core";

const confidenceColor = (c: string) => {
  switch (c) {
    case "validated": return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    case "assumed": return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    case "conflicting": return "bg-red-500/10 text-red-700 border-red-500/30";
    default: return "bg-zinc-500/10 text-zinc-600 border-zinc-500/30";
  }
};

interface TranscriptResultsProps {
  analysisResult: {
    insights: { text: string; confidence: string }[];
    key_themes: string[];
    sentiment: string;
  } | null;
  extractedEvidence: Evidence[];
  savedAnalyses: TranscriptAnalysis[];
}

export function TranscriptResults({ analysisResult, extractedEvidence, savedAnalyses }: TranscriptResultsProps) {
  return (
    <>
      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis Results</CardTitle>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">Sentiment: {analysisResult.sentiment}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Key Themes</h4>
              <div className="flex flex-wrap gap-1.5">
                {analysisResult.key_themes.map((theme, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{theme}</Badge>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Insights</h4>
              <div className="space-y-2">
                {analysisResult.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded border">
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${confidenceColor(insight.confidence)}`}>
                      {insight.confidence}
                    </Badge>
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
                    <Badge variant="secondary" className="ml-2">{extractedEvidence.length}</Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Auto-extracted from transcript and saved to Evidence.
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
      )}

      {savedAnalyses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Previous Analyses
              <Badge variant="secondary" className="ml-2">{savedAnalyses.length}</Badge>
            </CardTitle>
            <CardDescription>Saved transcript analyses for this discovery.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {[...savedAnalyses].reverse().map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{a.sentiment}</Badge>
                        {a.key_themes.slice(0, 3).map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.transcript_text}</p>
                    {a.insights.length > 0 && (
                      <div className="space-y-1">
                        {a.insights.slice(0, 3).map((ins, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <Badge variant="outline" className={`text-[9px] shrink-0 ${confidenceColor(ins.confidence)}`}>
                              {ins.confidence}
                            </Badge>
                            <p className="text-xs">{ins.text}</p>
                          </div>
                        ))}
                        {a.insights.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{a.insights.length - 3} more insights
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
      )}
    </>
  );
}
