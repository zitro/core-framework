"use client";

/**
 * Capture drop-zone — paste raw text and run extract+classify.
 *
 * Shows the dry-run diff (DB creates/replaces and per-candidate vertex
 * projection paths). Persistence is intentionally NOT in this component
 * — the user accepts in the next phase. Keeping accept downstream is
 * what makes the drop-zone safe to spam with experimental input.
 */

import { useState } from "react";
import { Upload, Loader2, Wand2, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { ExtractResults } from "@/components/capture/extract-results";

interface DropZoneProps {
  projectId: string;
}

type ExtractResponse = Awaited<ReturnType<typeof api.capture.extractClassify>>;

const MAX_INPUT_CHARS = 12000;

export function DropZone({ projectId }: DropZoneProps) {
  const [rawText, setRawText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResponse | null>(null);

  const charCount = rawText.length;
  const overLimit = charCount > MAX_INPUT_CHARS;
  const canSubmit = !!projectId && rawText.trim().length >= 4 && !busy && !overLimit;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.capture.extractClassify(projectId, {
        raw_text: rawText,
        source_label: sourceLabel.trim(),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extract failed");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setRawText("");
    setSourceLabel("");
  };

  if (!projectId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <FileWarning className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Select an active project to use the drop-zone.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (result) {
    return (
      <ExtractResults
        result={result}
        onDiscard={handleReset}
        sourceLabel={sourceLabel || "drop-zone"}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" aria-hidden />
              Drop-zone
            </CardTitle>
            <CardDescription>
              Paste raw notes, transcripts, or copy-paste from any tool. We&apos;ll
              extract typed artifact candidates and show you exactly what would
              change before anything is written.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            dry-run
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="capture-source-label"
            className="text-xs font-medium text-muted-foreground"
          >
            Source label (optional)
          </label>
          <Input
            id="capture-source-label"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="e.g. discovery call, internal brief, RFP excerpt"
            disabled={busy}
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="capture-raw-text"
            className="text-xs font-medium text-muted-foreground"
          >
            Raw input
          </label>
          <Textarea
            id="capture-raw-text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste anything: meeting notes, transcripts, screenshots-as-text, an RFP paragraph…"
            disabled={busy}
            rows={10}
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()} chars</span>
            {overLimit && (
              <span className="text-destructive">Trim input to fit the model window.</span>
            )}
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Extracting…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" aria-hidden />
                Extract & classify
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={busy || (!rawText && !sourceLabel)}
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
