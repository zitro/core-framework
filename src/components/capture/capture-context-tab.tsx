"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Evidence } from "@/types/core";
import { api } from "@/lib/api";
import {
  CONTEXT_OPTIONS,
  type CaptureItemType,
} from "@/components/capture/capture-context-options";
import {
  CaptureContextForm,
  type PendingEvidenceFile,
} from "@/components/capture/capture-context-form";
import { CaptureContextAside } from "@/components/capture/capture-context-aside";

interface Props {
  discoveryId: string;
  quickNote: string;
  setQuickNote: (v: string) => void;
  captureItemType: CaptureItemType;
  setCaptureItemType: (v: CaptureItemType) => void;
  captureReference: string;
  setCaptureReference: (v: string) => void;
}

export function CaptureContextTab({
  discoveryId,
  quickNote,
  setQuickNote,
  captureItemType,
  setCaptureItemType,
  captureReference,
  setCaptureReference,
}: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<Evidence[]>([]);
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const [editingEvidenceContent, setEditingEvidenceContent] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingEvidenceFile[]>([]);
  const [savingNoteAction, setSavingNoteAction] = useState<"save" | "add-another" | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const savingNote = savingNoteAction !== null;
  const canSaveContext =
    quickNote.trim().length > 0 || evidenceUrl.trim().length > 0 || pendingFiles.length > 0;

  const selectedContextOption = useMemo(
    () => CONTEXT_OPTIONS.find((option) => option.value === captureItemType) ?? CONTEXT_OPTIONS[0],
    [captureItemType],
  );

  const evidenceTypeCounts = useMemo(() => {
    return captureEvidence.reduce<Record<string, number>>((acc, item) => {
      const key = item.evidence_type || "general";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [captureEvidence]);

  const loadSavedData = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const evidenceItems = await api.evidence.list(discoveryId, "capture");
      setCaptureEvidence(evidenceItems);
    } catch {
      /* non-critical — first load may have no data */
    }
  }, [discoveryId]);

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  async function addQuickNote(action: "save" | "add-another"): Promise<void> {
    const hasNote = quickNote.trim().length > 0;
    const hasUrl = evidenceUrl.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasNote && !hasUrl && !hasFiles) || !discoveryId) return;
    setSavingNoteAction(action);
    setError(null);
    const contextOption = selectedContextOption;
    const baseTags = Array.from(new Set(["context", ...contextOption.tags]));
    try {
      const createdItems: Evidence[] = [];

      if (hasNote && !hasUrl && !hasFiles) {
        const created = await api.evidence.create({
          discovery_id: discoveryId,
          phase: "capture",
          content: quickNote.trim(),
          source: captureReference.trim() || contextOption.source,
          evidence_type: contextOption.evidenceType,
          tags: baseTags,
        });
        createdItems.push(created);
      }

      if (hasUrl) {
        const created = await api.evidence.create({
          discovery_id: discoveryId,
          phase: "capture",
          content: quickNote.trim() || `Evidence link added: ${evidenceUrl.trim()}`,
          source: evidenceUrl.trim(),
          evidence_type: contextOption.value === "url" ? contextOption.evidenceType : "general",
          tags: Array.from(new Set([...baseTags, "evidence", "url"])),
        });
        createdItems.push(created);
      }

      for (const file of pendingFiles) {
        const created = await api.evidence.upload({
          discovery_id: discoveryId,
          phase: "capture",
          source: captureReference.trim() || file.name,
          evidence_type: contextOption.evidenceType,
          note: quickNote.trim(),
          tags: Array.from(new Set([...baseTags, "evidence", "file"])),
          file: file.file,
        });
        createdItems.push(created);
      }

      setCaptureEvidence((prev) => [...prev, ...createdItems]);
      setQuickNote("");
      setCaptureReference("");
      setEvidenceUrl("");
      setPendingFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (action === "add-another") {
        window.requestAnimationFrame(() => quickNoteTextareaRef.current?.focus());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save capture note");
    } finally {
      setSavingNoteAction(null);
    }
  }

  async function onSelectFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;

    const selected = await Promise.all(
      Array.from(files).map(async (file) => {
        return {
          file,
          name: file.name,
          type: file.type,
          size: file.size,
        } satisfies PendingEvidenceFile;
      }),
    );

    setPendingFiles((prev) => {
      const next = [...prev];
      for (const file of selected) {
        if (!next.some((item) => item.name === file.name && item.size === file.size)) {
          next.push(file);
        }
      }
      return next;
    });
  }

  function removePendingFile(name: string, size: number): void {
    setPendingFiles((prev) => prev.filter((item) => !(item.name === name && item.size === size)));
  }

  function startEditingEvidence(item: Evidence): void {
    setEditingEvidenceId(item.id);
    setEditingEvidenceContent(item.content);
  }

  function cancelEditing(): void {
    setEditingEvidenceId(null);
    setEditingEvidenceContent("");
  }

  async function saveEvidenceEdit(): Promise<void> {
    if (!editingEvidenceId || !editingEvidenceContent.trim()) return;
    try {
      const updated = await api.evidence.update(editingEvidenceId, {
        content: editingEvidenceContent.trim(),
      });
      setCaptureEvidence((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingEvidenceId(null);
      setEditingEvidenceContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update context item");
    }
  }

  async function deleteEvidenceItem(id: string): Promise<void> {
    try {
      await api.evidence.delete(id);
      setCaptureEvidence((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete context item");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]">
      <CaptureContextForm
        quickNote={quickNote}
        setQuickNote={setQuickNote}
        captureItemType={captureItemType}
        setCaptureItemType={setCaptureItemType}
        captureReference={captureReference}
        setCaptureReference={setCaptureReference}
        evidenceUrl={evidenceUrl}
        setEvidenceUrl={setEvidenceUrl}
        pendingFiles={pendingFiles}
        removePendingFile={removePendingFile}
        onSelectFiles={(files) => void onSelectFiles(files)}
        selectedContextOption={selectedContextOption}
        savingNote={savingNote}
        savingNoteAction={savingNoteAction}
        canSaveContext={canSaveContext}
        error={error}
        onSave={(action) => void addQuickNote(action)}
        fileInputRef={fileInputRef}
        quickNoteTextareaRef={quickNoteTextareaRef}
      />
      <CaptureContextAside
        captureEvidence={captureEvidence}
        evidenceTypeCounts={evidenceTypeCounts}
        editingEvidenceId={editingEvidenceId}
        editingEvidenceContent={editingEvidenceContent}
        setEditingEvidenceContent={setEditingEvidenceContent}
        cancelEditing={cancelEditing}
        startEditingEvidence={startEditingEvidence}
        saveEvidenceEdit={() => void saveEvidenceEdit()}
        deleteEvidenceItem={(id) => void deleteEvidenceItem(id)}
      />
    </div>
  );
}
