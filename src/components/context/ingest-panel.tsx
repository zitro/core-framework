"use client";

import { useCallback, useState } from "react";
import {
  Sparkles,
  FileUp,
  Loader2,
  CheckCircle2,
  FileText,
  FolderOpen,
  AlertCircle,
  ClipboardPaste,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { IngestClassification, IngestWriteResult } from "@/types/core";
import { StepIndicator, ConfidenceBadge, DetailCard } from "@/components/context/ingest-shared";

type IngestStep = "input" | "classifying" | "preview" | "writing" | "done";

interface IngestPanelProps {
  repoPath: string;
  onFileWritten?: () => void;
}

export function IngestPanel({ repoPath, onFileWritten }: IngestPanelProps) {
  const [step, setStep] = useState<IngestStep>("input");
  const [content, setContent] = useState("");
  const [classification, setClassification] = useState<IngestClassification | null>(null);
  const [writeResult, setWriteResult] = useState<IngestWriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClassify = useCallback(async () => {
    if (!content.trim() || !repoPath) return;
    setStep("classifying");
    setError(null);
    try {
      const result = await api.engagement.ingestClassify(repoPath, content.trim());
      setClassification(result);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classification failed");
      setStep("input");
    }
  }, [content, repoPath]);

  const handleWrite = useCallback(async () => {
    if (!classification) return;
    setStep("writing");
    setError(null);
    try {
      const result = await api.engagement.ingestWrite({
        content_dir: classification.content_dir,
        directory: classification.placement.directory,
        filename: classification.placement.filename,
        content: classification.generated_content,
        action: classification.placement.action,
        append_target: classification.placement.append_target,
      });
      setWriteResult(result);
      setStep("done");
      toast.success("Content written to engagement repo");
      onFileWritten?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Write failed");
      setStep("preview");
    }
  }, [classification, onFileWritten]);

  const handleReset = useCallback(() => {
    setStep("input");
    setContent("");
    setClassification(null);
    setWriteResult(null);
    setError(null);
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" />
          AI Content Ingest
        </CardTitle>
        <CardDescription>
          Paste raw content — AI classifies it and writes it to the right place in your repo
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Step: Input */}
        {step === "input" && (
          <div className="space-y-3">
            <Textarea
              placeholder="Paste meeting notes, email threads, call transcripts, technical specs, or any unstructured content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[180px] text-sm leading-relaxed resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {content.trim().split(/\s+/).filter(Boolean).length} words
              </span>
              <Button
                onClick={handleClassify}
                disabled={!content.trim()}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Classify with AI
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Classifying */}
        {step === "classifying" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
              </div>
            </div>
            <p className="text-sm font-medium">Analyzing content...</p>
            <p className="text-xs text-muted-foreground">
              AI is classifying the content type and suggesting placement
            </p>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && classification && (
          <div className="space-y-4">
            {/* AI Summary */}
            <div className="rounded-lg border bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">AI Classification</span>
                <ConfidenceBadge level={classification.classification.confidence} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {classification.summary}
              </p>
            </div>

            {/* Classification details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailCard
                icon={FileText}
                label="Content Type"
                value={classification.classification.type}
                sublabel={classification.classification.title}
              />
              <DetailCard
                icon={FolderOpen}
                label="Placement"
                value={classification.placement.directory}
                sublabel={`${classification.placement.filename} (${classification.placement.action})`}
              />
            </div>

            {/* Preview of generated content */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Generated Content Preview
              </p>
              <div className="rounded-lg border bg-muted/30 max-h-[200px] overflow-auto">
                <pre className="p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80">
                  {classification.generated_content.slice(0, 1200)}
                  {classification.generated_content.length > 1200 && (
                    <span className="text-muted-foreground">
                      {"\n"}... ({classification.generated_content.length - 1200} more characters)
                    </span>
                  )}
                </pre>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
                Back to edit
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Start over
                </Button>
                <Button onClick={handleWrite} className="gap-1.5">
                  <FileUp className="h-3.5 w-3.5" />
                  Write to repo
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Writing */}
        {step === "writing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium">Writing to repo...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && writeResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <p className="text-sm font-medium">Content written successfully</p>
              <p className="text-xs text-muted-foreground font-mono">
                {writeResult.path}
              </p>
              <Badge variant="outline" className="text-xs capitalize">
                {writeResult.action}
              </Badge>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleReset} variant="outline" className="gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5" />
                Ingest more content
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
