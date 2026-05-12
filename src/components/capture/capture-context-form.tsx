"use client";

import type { RefObject } from "react";
import { Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTEXT_OPTIONS,
  type CaptureItemType,
  type ContextOption,
} from "@/components/capture/capture-context-options";

export interface PendingEvidenceFile {
  file: File;
  name: string;
  type: string;
  size: number;
}

interface Props {
  quickNote: string;
  setQuickNote: (v: string) => void;
  captureItemType: CaptureItemType;
  setCaptureItemType: (v: CaptureItemType) => void;
  captureReference: string;
  setCaptureReference: (v: string) => void;
  evidenceUrl: string;
  setEvidenceUrl: (v: string) => void;
  pendingFiles: PendingEvidenceFile[];
  removePendingFile: (name: string, size: number) => void;
  onSelectFiles: (files: FileList | null) => void;
  selectedContextOption: ContextOption;
  savingNote: boolean;
  savingNoteAction: "save" | "add-another" | null;
  canSaveContext: boolean;
  error: string | null;
  onSave: (action: "save" | "add-another") => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  quickNoteTextareaRef: RefObject<HTMLTextAreaElement | null>;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CaptureContextForm({
  quickNote,
  setQuickNote,
  captureItemType,
  setCaptureItemType,
  captureReference,
  setCaptureReference,
  evidenceUrl,
  setEvidenceUrl,
  pendingFiles,
  removePendingFile,
  onSelectFiles,
  selectedContextOption,
  savingNote,
  savingNoteAction,
  canSaveContext,
  error,
  onSave,
  fileInputRef,
  quickNoteTextareaRef,
}: Props): React.ReactElement {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave("save");
      }}
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {CONTEXT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = captureItemType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setCaptureItemType(option.value)}
              aria-pressed={active}
              className={`group flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                active
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-border bg-background text-foreground/80 hover:border-brand/40 hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${
                  active ? "text-brand" : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              <span className="min-w-0 truncate font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {selectedContextOption.description}
      </p>

      <Textarea
        ref={quickNoteTextareaRef}
        value={quickNote}
        onChange={(e) => setQuickNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canSaveContext && !savingNote) onSave("save");
          }
        }}
        placeholder={selectedContextOption.placeholder}
        rows={selectedContextOption.value === "transcript" ? 12 : 8}
        className="resize-y text-sm leading-relaxed"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={captureReference}
          onChange={(e) => setCaptureReference(e.target.value)}
          placeholder={
            selectedContextOption.value === "transcript"
              ? "Meeting, speaker, or session label"
              : "Source / reference (optional)"
          }
        />
        <Input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder={selectedContextOption.value === "url" ? "URL" : "Related URL (optional)"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
        >
          <Paperclip className="h-3 w-3" />
          Attach files
        </button>
        {pendingFiles.length > 0 && (
          <span className="text-muted-foreground">
            {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} attached
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Select evidence files"
          title="Select evidence files"
          onChange={(e) => onSelectFiles(e.target.files)}
        />
      </div>

      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          {pendingFiles.map((file) => (
            <div
              key={`${file.name}:${file.size}`}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{file.name}</span>
                <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => removePendingFile(file.name, file.size)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="text-[11px] text-muted-foreground">
          <kbd className="rounded border bg-muted/60 px-1 font-mono text-[10px]">⌘</kbd>
          <span className="mx-0.5">+</span>
          <kbd className="rounded border bg-muted/60 px-1 font-mono text-[10px]">Enter</kbd> to save
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSave("add-another")}
            disabled={savingNote || !canSaveContext}
            size="sm"
          >
            <Plus className="mr-1 h-3 w-3" />
            {savingNoteAction === "add-another" ? "Saving..." : "Save & add another"}
          </Button>
          <Button type="submit" disabled={savingNote || !canSaveContext} size="sm">
            {savingNoteAction === "save" ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
