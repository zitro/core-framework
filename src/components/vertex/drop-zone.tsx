"use client";

/**
 * VertexDropZone — side sheet on /vertex letting users paste, upload, or
 * fetch from URL, then AI-classify and write into the connected repo.
 */

import { useCallback, useId, useRef, useState } from "react";
import { FileUp, Link2, Loader2, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { v2Api } from "@/lib/api-v2";

import { VertexClassifyResult, type ClassifyState } from "./classify-result";

type Source = "paste" | "file" | "url";
type Step = "input" | "analyzing" | "result";

interface DropZoneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSaved: (path: string) => void;
}

export function VertexDropZone({ open, onOpenChange, projectId, onSaved }: DropZoneProps) {
  const [tab, setTab] = useState<Source>("paste");
  const [step, setStep] = useState<Step>("input");
  const [pasteText, setPasteText] = useState("");
  const [hint, setHint] = useState("");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [classification, setClassification] = useState<ClassifyState | null>(null);
  const [saving, setSaving] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const overwriteId = useId();

  const reset = useCallback(() => {
    setStep("input");
    setPasteText("");
    setHint("");
    setUrl("");
    setPendingFile(null);
    setContent("");
    setClassification(null);
    setOverwrite(false);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setStep("analyzing");
    try {
      let extracted = pasteText;
      let seed: string | undefined;
      if (tab === "url" && url.trim()) {
        const res = await v2Api.vertexExtractUrl(projectId, url.trim());
        extracted = res.text;
        seed = url.replace(/[^a-z0-9-]+/gi, "-").slice(0, 60);
      } else if (tab === "file" && pendingFile) {
        const res = await v2Api.vertexExtractFile(projectId, pendingFile);
        extracted = res.text;
        seed = pendingFile.name;
      } else if (tab === "paste") {
        seed = hint || undefined;
      }
      if (!extracted.trim()) throw new Error("No content extracted");
      setContent(extracted);
      const cls = await v2Api.vertexClassify(projectId, {
        content: extracted,
        hint: hint || undefined,
        filename: seed,
      });
      setClassification(cls);
      setStep("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Classify failed";
      toast.error(msg);
      setStep("input");
    }
  }, [tab, pasteText, url, pendingFile, projectId, hint]);

  const handleSave = useCallback(async () => {
    if (!classification) return;
    setSaving(true);
    try {
      const path = classification.dest_path
        ? `${classification.dest_path.replace(/\/+$/, "")}/${classification.filename}`
        : classification.filename;
      const res = await v2Api.vertexWrite(projectId, {
        path,
        content,
        overwrite,
        source: tab,
        classifier_confidence: classification.confidence,
      });
      toast.success(`Saved ${res.path}`);
      onSaved(res.path);
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      if (msg.toLowerCase().includes("exists")) {
        setOverwrite(true);
        toast.error("File exists — toggle overwrite and save again");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }, [classification, content, projectId, overwrite, tab, onSaved, onOpenChange, reset]);

  const canAnalyze =
    (tab === "paste" && pasteText.trim().length > 0) ||
    (tab === "url" && /^https?:\/\//i.test(url.trim())) ||
    (tab === "file" && pendingFile !== null);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Add to repo
          </SheetTitle>
          <SheetDescription>
            Drop anything — we&apos;ll file it. Paste, upload, or link, then accept the proposed
            destination.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {step === "input" && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as Source)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="paste" className="gap-1.5">
                  <Type className="size-3.5" aria-hidden /> Paste
                </TabsTrigger>
                <TabsTrigger value="file" className="gap-1.5">
                  <FileUp className="size-3.5" aria-hidden /> Upload
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-1.5">
                  <Link2 className="size-3.5" aria-hidden /> URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-3 space-y-2">
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste markdown, notes, transcript, anything textual…"
                  className="min-h-[14rem] resize-y font-mono text-xs"
                />
              </TabsContent>

              <TabsContent value="file" className="mt-3 space-y-2">
                <FileDrop
                  file={pendingFile}
                  onFile={setPendingFile}
                  inputRef={fileRef}
                />
              </TabsContent>

              <TabsContent value="url" className="mt-3 space-y-2">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll fetch the page and extract its main text.
                </p>
              </TabsContent>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium" htmlFor="hint">
                  Hint (optional)
                </label>
                <Input
                  id="hint"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="e.g. persona for a field rep"
                />
              </div>
            </Tabs>
          )}

          {step === "analyzing" && <AnalyzeProgress source={tab} />}

          {step === "result" && classification && (
            <VertexClassifyResult
              state={classification}
              onChange={setClassification}
              preview={content}
            />
          )}
        </div>

        <SheetFooter className="border-t bg-muted/20 p-3">
          {step === "input" && (
            <div className="flex w-full items-center justify-between">
              <SheetClose render={<Button variant="ghost" size="sm" />}>Cancel</SheetClose>
              <Button size="sm" disabled={!canAnalyze} onClick={() => void handleAnalyze()}>
                <Sparkles className="size-3.5" aria-hidden /> Analyze
              </Button>
            </div>
          )}
          {step === "result" && classification && (
            <div className="flex w-full items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  id={overwriteId}
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Overwrite if exists
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setStep("input")}>
                  Back
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…
                    </>
                  ) : (
                    "Save to repo"
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FileDrop({
  file,
  onFile,
  inputRef,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={
        "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm transition " +
        (hover ? "border-primary bg-primary/5" : "border-muted-foreground/30")
      }
    >
      <FileUp className="size-6 text-muted-foreground" aria-hidden />
      {file ? (
        <>
          <p className="font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </p>
          <Button variant="ghost" size="sm" onClick={() => onFile(null)}>
            Remove
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">
            Drag a file here, or{" "}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => inputRef.current?.click()}
            >
              browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Supports .md, .txt, .pdf, .docx, .html, .json, .yaml, .csv
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt,.pdf,.docx,.html,.htm,.json,.yaml,.yml,.csv"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function AnalyzeProgress({ source }: { source: Source }) {
  const steps = [
    source === "paste" ? "Reading paste" : source === "url" ? "Fetching URL" : "Reading file",
    "Classifying",
    "Proposing path",
  ];
  return (
    <div className="space-y-3 py-6">
      {steps.map((label) => (
        <div key={label} className="flex items-center gap-2 text-sm">
          <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
          <span>{label}…</span>
        </div>
      ))}
    </div>
  );
}
