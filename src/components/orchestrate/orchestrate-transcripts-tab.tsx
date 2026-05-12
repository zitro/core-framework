"use client";

import { AudioLines, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  type AnalysisSummary,
  TranscriptAnalysisResult,
} from "@/components/capture/transcript-analysis-result";
import { PreviousAnalysesList } from "@/components/capture/previous-analyses-list";
import { previewText } from "@/components/orchestrate/orchestrate-constants";
import type { Evidence, TranscriptAnalysis } from "@/types/core";

type Props = {
  transcriptEvidence: Evidence[];
  selectedTranscript: Evidence | undefined;
  selectedTranscriptId: string;
  onSelectTranscriptId: (id: string) => void;
  analyzingTranscript: boolean;
  onAnalyzeSelected: () => void;
  savedAnalyses: TranscriptAnalysis[];
  analysisResult: AnalysisSummary | null;
  extractedTranscriptEvidence: Evidence[];
  analysisNotes: string;
  onAnalysisNotesChange: (value: string) => void;
  onAddAnalysisNotesToContext: () => void;
};

export function OrchestrateTranscriptsTab({
  transcriptEvidence,
  selectedTranscript,
  onSelectTranscriptId,
  analyzingTranscript,
  onAnalyzeSelected,
  savedAnalyses,
  analysisResult,
  extractedTranscriptEvidence,
  analysisNotes,
  onAnalysisNotesChange,
  onAddAnalysisNotesToContext,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AudioLines className="h-4 w-4" />
          Transcript Analysis
        </CardTitle>
        <CardDescription>
          Analyze raw transcripts captured upstream, then fold judgment, pushback, and refinements into Orchestrate context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {transcriptEvidence.length > 0 && (
          <>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {transcriptEvidence.map((item) => {
                const active = selectedTranscript?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTranscriptId(item.id)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      active ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"
                    }`}
                  >
                    <span className="block text-sm font-medium">{item.source || "Transcript"}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {previewText(item.content)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onAnalyzeSelected} disabled={analyzingTranscript || !selectedTranscript} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {analyzingTranscript ? "Analyzing..." : "Analyze Selected Transcript"}
              </Button>
              <Badge variant="secondary">Captured transcripts: {transcriptEvidence.length}</Badge>
              <Badge variant="outline">Saved analyses: {savedAnalyses.length}</Badge>
            </div>
          </>
        )}

        {analysisResult && (
          <TranscriptAnalysisResult result={analysisResult} extractedEvidence={extractedTranscriptEvidence} />
        )}

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-medium">Analysis review notes</p>
          <Textarea
            value={analysisNotes}
            onChange={(e) => onAnalysisNotesChange(e.target.value)}
            placeholder="Add your opinion, corrections, pushback, or refinement notes for this transcript analysis..."
            rows={3}
          />
          <Button variant="outline" onClick={onAddAnalysisNotesToContext} disabled={!analysisNotes.trim()}>
            Add Analysis Notes To Context
          </Button>
        </div>

        <PreviousAnalysesList analyses={savedAnalyses} />
      </CardContent>
    </Card>
  );
}
