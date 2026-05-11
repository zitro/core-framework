"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  HelpCircle,
  Lightbulb,
  Link as LinkIcon,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Quote,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  Evidence,
  TechnologyTarget,
} from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";
import { DiscoveryRequired } from "@/components/layout/discovery-required";
import { EngagementConfig } from "@/components/settings/engagement-config";
import { methodsForPhase } from "@/lib/dt-methods";

interface CaptureDraft {
  transcript: string;
  quickNote: string;
  captureItemType: CaptureItemType;
  captureReference: string;
  technologyInput: string;
  technologyFocusInput: string;
  technologyTargets: TechnologyTarget[];
}

type CaptureItemType =
  | "note"
  | "observation"
  | "quote"
  | "pain_point"
  | "jtbd"
  | "assumption"
  | "question"
  | "decision"
  | "document"
  | "presentation"
  | "recording"
  | "file"
  | "url";

type ContextOption = {
  value: CaptureItemType;
  label: string;
  description: string;
  placeholder: string;
  source: string;
  evidenceType: Evidence["evidence_type"];
  tags: string[];
  icon: typeof Lightbulb;
  methodIds: string[];
};

const CAPTURE_METHODS = methodsForPhase("capture");

const CONTEXT_OPTIONS: ContextOption[] = [
  {
    value: "note",
    label: "Note",
    description: "General project knowledge, meeting notes, or context fragments.",
    placeholder: "Add project context, stakeholder input, or a useful note...",
    source: "Capture note",
    evidenceType: "observation",
    tags: ["note"],
    icon: Lightbulb,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "observation",
    label: "Observation",
    description: "What was seen or heard before interpretation.",
    placeholder: "Describe what happened, who was involved, and what stood out...",
    source: "Direct observation",
    evidenceType: "observation",
    tags: ["design-thinking", "observation"],
    icon: Eye,
    methodIds: ["observation", "empathy-map"],
  },
  {
    value: "quote",
    label: "Quote",
    description: "Verbatim stakeholder language worth preserving.",
    placeholder: "Paste the quote and add speaker/context if known...",
    source: "Stakeholder quote",
    evidenceType: "quote",
    tags: ["design-thinking", "quote"],
    icon: Quote,
    methodIds: ["stakeholder-interviews", "empathy-map"],
  },
  {
    value: "pain_point",
    label: "Pain Point",
    description: "A friction, delay, risk, or unmet need.",
    placeholder: "Name the friction, who feels it, and the impact...",
    source: "Pain point",
    evidenceType: "pain_point",
    tags: ["design-thinking", "pain-point"],
    icon: AlertTriangle,
    methodIds: ["jtbd", "observation"],
  },
  {
    value: "jtbd",
    label: "JTBD",
    description: "A job, motivation, and desired outcome.",
    placeholder: "When..., I want to..., so I can...",
    source: "Job-to-be-done",
    evidenceType: "jtbd",
    tags: ["design-thinking", "jtbd"],
    icon: CheckCircle2,
    methodIds: ["jtbd", "stakeholder-interviews"],
  },
  {
    value: "assumption",
    label: "Assumption",
    description: "A belief that should be validated later.",
    placeholder: "State the assumption and what would prove or disprove it...",
    source: "Assumption",
    evidenceType: "assumption",
    tags: ["design-thinking", "assumption"],
    icon: HelpCircle,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "question",
    label: "Question",
    description: "An open question the team needs to answer.",
    placeholder: "Capture the question and why it matters...",
    source: "Open question",
    evidenceType: "hypothesis",
    tags: ["question", "follow-up"],
    icon: HelpCircle,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "decision",
    label: "Decision",
    description: "A confirmed choice, constraint, or direction.",
    placeholder: "Record the decision, owner, date, and rationale...",
    source: "Decision",
    evidenceType: "insight",
    tags: ["decision"],
    icon: CheckCircle2,
    methodIds: [],
  },
  {
    value: "document",
    label: "Document",
    description: "Docs, PDFs, spreadsheets, exports, or reference files.",
    placeholder: "Add any context that helps interpret the attached document...",
    source: "Document evidence",
    evidenceType: "general",
    tags: ["evidence", "document"],
    icon: FileText,
    methodIds: ["empathy-map"],
  },
  {
    value: "presentation",
    label: "Deck",
    description: "Slides, briefings, and stakeholder presentations.",
    placeholder: "Describe the deck, audience, date, or important sections...",
    source: "Presentation evidence",
    evidenceType: "general",
    tags: ["evidence", "presentation"],
    icon: FileText,
    methodIds: [],
  },
  {
    value: "recording",
    label: "Recording",
    description: "Calls, interviews, workshops, demos, and voice notes.",
    placeholder: "Add meeting context, speakers, or what the recording captures...",
    source: "Recording evidence",
    evidenceType: "general",
    tags: ["evidence", "recording"],
    icon: Mic,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "file",
    label: "Other File",
    description: "Any other artifact that should be preserved as context.",
    placeholder: "Describe what this file is and why it matters...",
    source: "File evidence",
    evidenceType: "general",
    tags: ["evidence", "file"],
    icon: Paperclip,
    methodIds: [],
  },
  {
    value: "url",
    label: "URL",
    description: "External links, docs, articles, repos, or dashboards.",
    placeholder: "Add why this link matters and what to look for...",
    source: "Link evidence",
    evidenceType: "general",
    tags: ["evidence", "url"],
    icon: LinkIcon,
    methodIds: [],
  },
];

interface PendingEvidenceFile {
  file: File;
  name: string;
  type: string;
  size: number;
}

export default function CapturePage() {
  // State and refs
  const { activeDiscovery, setActiveDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";

  const [transcript, setTranscript] = useState("");
  const [transcriptSource, setTranscriptSource] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<Evidence[]>([]);
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const [editingEvidenceContent, setEditingEvidenceContent] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [captureItemType, setCaptureItemType] = useState<CaptureItemType>("note");
  const [captureReference, setCaptureReference] = useState("");
  const [savingNoteAction, setSavingNoteAction] = useState<"save" | "add-another" | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingEvidenceFile[]>([]);
  const [technologyInput, setTechnologyInput] = useState("");
  const [technologyFocusInput, setTechnologyFocusInput] = useState("");
  const [technologyTargets, setTechnologyTargets] = useState<TechnologyTarget[]>([]);
  const [savingTechnologies, setSavingTechnologies] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const savingNote = savingNoteAction !== null;
  const canSaveContext = quickNote.trim().length > 0 || evidenceUrl.trim().length > 0 || pendingFiles.length > 0;

  const selectedContextOption = useMemo(
    () => CONTEXT_OPTIONS.find((option) => option.value === captureItemType) ?? CONTEXT_OPTIONS[0],
    [captureItemType],
  );

  const contextCaptureGuidance = useMemo(() => {
    switch (selectedContextOption.value) {
      case "document":
        return "Describe the document, then attach the file or add a related link so the project context keeps both the artifact and your interpretation.";
      case "presentation":
        return "Describe the deck, audience, date, or important sections, then attach the presentation or supporting links.";
      case "recording":
        return "Add meeting context, speakers, or what the recording captures, then attach the audio or video file.";
      case "file":
        return "Describe what the file is and why it matters, then attach the artifact so downstream AI can use it as evidence.";
      case "url":
        return "Add why the link matters, paste the URL, and include any short note that helps interpret it later.";
      default:
        return selectedContextOption.description;
    }
  }, [selectedContextOption]);

  const evidenceTypeCounts = useMemo(() => {
    return captureEvidence.reduce<Record<string, number>>((acc, item) => {
      const key = item.evidence_type || "general";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [captureEvidence]);

  const previewText = (value: string) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const captureDraftKey = useMemo(
    () => `core:capture-draft:${discoveryId || activeDiscovery?.project_id || "global"}`,
    [activeDiscovery?.project_id, discoveryId],
  );

  const readCaptureDraft = useCallback((): CaptureDraft | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(captureDraftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CaptureDraft;
      return {
        transcript: parsed.transcript || "",
        quickNote: parsed.quickNote || "",
        captureItemType: (parsed.captureItemType as CaptureItemType) || "note",
        captureReference: parsed.captureReference || "",
        technologyInput: parsed.technologyInput || "",
        technologyFocusInput: parsed.technologyFocusInput || "",
        technologyTargets: Array.isArray(parsed.technologyTargets) ? parsed.technologyTargets : [],
      };
    } catch {
      return null;
    }
  }, [captureDraftKey]);

  useEffect(() => {
    if (!activeDiscovery) {
      setDraftHydrated(false);
      return;
    }

    const draft = readCaptureDraft();
    const persistedTargets = activeDiscovery.target_technologies ?? [];
    const providerFallbackTargets = (activeDiscovery.solution_providers ?? []).map((name) => ({
      name,
      focus: "",
    }));

    const nextTargets =
      persistedTargets.length > 0
        ? persistedTargets
        : providerFallbackTargets.length > 0
          ? providerFallbackTargets
          : (draft?.technologyTargets ?? []);

    setTranscript(draft?.transcript || "");
    setQuickNote(draft?.quickNote || "");
    setCaptureItemType(draft?.captureItemType || "note");
    setCaptureReference(draft?.captureReference || "");
    setTechnologyInput(draft?.technologyInput || "");
    setTechnologyFocusInput(draft?.technologyFocusInput || "");
    setTechnologyTargets(nextTargets);
    setDraftHydrated(true);
  }, [
    activeDiscovery,
    activeDiscovery?.id,
    activeDiscovery?.solution_providers,
    activeDiscovery?.target_technologies,
    readCaptureDraft,
  ]);

  useEffect(() => {
    if (!activeDiscovery || !draftHydrated || typeof window === "undefined") return;
    const payload: CaptureDraft = {
      transcript,
      quickNote,
      captureItemType,
      captureReference,
      technologyInput,
      technologyFocusInput,
      technologyTargets,
    };
    try {
      window.localStorage.setItem(captureDraftKey, JSON.stringify(payload));
    } catch {
      /* ignore localStorage failures */
    }
  }, [
    activeDiscovery,
    captureDraftKey,
    captureItemType,
    captureReference,
    draftHydrated,
    quickNote,
    technologyFocusInput,
    technologyInput,
    technologyTargets,
    transcript,
  ]);

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

  const persistTechnologyTargets = async (targets: TechnologyTarget[]) => {
    if (!discoveryId) return;
    setSavingTechnologies(true);
    try {
      const updated = await api.discoveries.update(discoveryId, {
        target_technologies: targets,
        solution_providers: targets.map((item) => item.name),
      });
      setActiveDiscovery(updated);
    } catch {
      // keep local state optimistic; user can retry on next edit
    } finally {
      setSavingTechnologies(false);
    }
  };

  const addTechnology = async () => {
    if (!technologyInput.trim() || !discoveryId) return;
    const name = technologyInput.trim();
    const focus = technologyFocusInput.trim();
    const exists = technologyTargets.some(
      (target) =>
        target.name.toLowerCase() === name.toLowerCase() &&
        target.focus.toLowerCase() === focus.toLowerCase()
    );
    if (exists) {
      setTechnologyInput("");
      setTechnologyFocusInput("");
      return;
    }
    const next = [...technologyTargets, { name, focus }];
    setTechnologyTargets(next);
    setTechnologyInput("");
    setTechnologyFocusInput("");
    await persistTechnologyTargets(next);
  };

  const removeTechnology = async (name: string, focus: string) => {
    if (!discoveryId) return;
    const next = technologyTargets.filter(
      (target) => !(target.name === name && target.focus === focus)
    );
    setTechnologyTargets(next);
    await persistTechnologyTargets(next);
  };

  const addQuickNote = async (action: "save" | "add-another" = "save") => {
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
          content:
            quickNote.trim() || `Evidence link added: ${evidenceUrl.trim()}`,
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
  };

  const onSelectEvidenceFiles = async (files: FileList | null) => {
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
  };

  const saveTranscript = async () => {
    if (!transcript.trim()) return;
    setSavingTranscript(true);
    setError(null);
    try {
      const created = await api.evidence.create({
        discovery_id: discoveryId,
        phase: "capture",
        content: transcript.trim(),
        source: transcriptSource.trim() || "Transcript",
        evidence_type: "general",
        tags: ["transcript", "raw-context"],
      });
      setCaptureEvidence((prev) => [...prev, created]);
      setTranscript("");
      setTranscriptSource("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to save transcript",
      );
    } finally {
      setSavingTranscript(false);
    }
  };

  const startEditingEvidence = (item: Evidence) => {
    setEditingEvidenceId(item.id);
    setEditingEvidenceContent(item.content);
  };

  const saveEvidenceEdit = async () => {
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
  };

  const deleteEvidenceItem = async (id: string) => {
    try {
      await api.evidence.delete(id);
      setCaptureEvidence((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete context item");
    }
  };

  if (!activeDiscovery) {
    return <DiscoveryRequired phase="capture" />;
  }

  return (
    <PhaseShell
      phase="capture"
      discoveryId={discoveryId}
      showEvidencePanel={false}
      showDtMethodsPanel={false}
    >
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="technologies">Technologies</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <EngagementConfig
            discovery={activeDiscovery}
            onUpdate={(patch) => {
              api.discoveries.update(activeDiscovery.id, patch).then((updated) => {
                setActiveDiscovery(updated);
              }).catch(() => {});
            }}
          />
        </TabsContent>

        <TabsContent value="context" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Context</CardTitle>
                  <CardDescription>
                    Follow the steps to add raw context. AI turns this into a versioned project brief in Orchestrate.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-md border border-blue-500/25 bg-blue-500/5 p-3 shadow-sm">
                    <div className="rounded-md bg-blue-500/10 px-3 py-2">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Step 1: Choose what you are adding</p>
                      <p className="text-xs text-blue-950/70 dark:text-blue-100/75">
                        Pick the closest type. It controls tagging only; you can still attach files, links, or notes.
                      </p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {CONTEXT_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = captureItemType === option.value;
                        const optionMethods = CAPTURE_METHODS.filter((method) =>
                          option.methodIds.includes(method.id),
                        );
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCaptureItemType(option.value)}
                            className={`rounded-md border p-3 text-left transition-colors ${
                              active
                                ? "min-h-[156px] border-primary bg-primary/5 text-foreground shadow-sm"
                                : "bg-background hover:bg-muted/40"
                            }`}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{option.label}</span>
                              </span>
                              {active && (
                                <Badge variant="secondary" className="shrink-0 text-[10px]">
                                  {option.evidenceType.replace("_", " ")}
                                </Badge>
                              )}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                              {option.description}
                            </span>
                            {active && (
                              <span className="mt-3 block space-y-2 rounded-md border bg-background/70 p-2">
                                {optionMethods.length > 0 && (
                                  <span className="flex flex-wrap gap-1.5">
                                    {optionMethods.map((method) => (
                                      <Badge key={method.id} variant="outline" className="text-[10px]">
                                        {method.name}
                                      </Badge>
                                    ))}
                                  </span>
                                )}
                                <span className="block text-xs leading-relaxed text-muted-foreground">
                                  {optionMethods[0]?.oneLiner ?? option.description}
                                </span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 shadow-sm">
                    <div className="rounded-md bg-amber-500/10 px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span>
                          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                            Step 2: Add {selectedContextOption.label.toLowerCase()} context and evidence
                          </p>
                          <p className="text-xs text-amber-950/75 dark:text-amber-100/75">
                            {contextCaptureGuidance}
                          </p>
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {selectedContextOption.evidenceType.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <Textarea
                      ref={quickNoteTextareaRef}
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder={selectedContextOption.placeholder}
                      rows={6}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={captureReference}
                        onChange={(e) => setCaptureReference(e.target.value)}
                        placeholder="Source, speaker, meeting, or short label"
                      />
                      <Input
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        placeholder={selectedContextOption.value === "url" ? "URL" : "Related URL"}
                      />
                    </div>
                    <div className="space-y-2 rounded-md border bg-background/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <p className="text-sm font-medium">Supporting evidence</p>
                          <p className="text-xs text-muted-foreground">
                            Optional files, recordings, decks, PDFs, docs, exports, or links for this {selectedContextOption.label.toLowerCase()}.
                          </p>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="shrink-0"
                        >
                          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                          Attach Files
                        </Button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        aria-label="Select evidence files"
                        title="Select evidence files"
                        onChange={(e) => void onSelectEvidenceFiles(e.target.files)}
                      />
                      <div className="space-y-2 text-sm">
                        {evidenceUrl.trim() && (
                          <div className="flex items-center gap-2 min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
                            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{evidenceUrl.trim()}</span>
                          </div>
                        )}
                        {pendingFiles.length === 0 && !evidenceUrl.trim() && (
                          <p className="text-xs text-muted-foreground">
                            Attachments and links added here will save with this context item.
                          </p>
                        )}
                        {pendingFiles.map((file) => (
                          <div
                            key={`${file.name}:${file.size}`}
                            className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{file.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatFileSize(file.size)}
                              </span>
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingFiles((prev) => prev.filter((item) => !(item.name === file.name && item.size === file.size)))}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 shadow-sm">
                    <Button
                      onClick={() => void addQuickNote("save")}
                      disabled={savingNote || !canSaveContext}
                    >
                      {savingNoteAction === "save" ? "Saving..." : "Save Context Item"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void addQuickNote("add-another")}
                      disabled={savingNote || !canSaveContext}
                      className="bg-background/80"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {savingNoteAction === "add-another" ? "Saving..." : "Save & Add Another"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Saved items become Capture evidence and feed downstream AI work.
                    </span>
                  </div>
                  {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Saved Context</CardTitle>
                  <CardDescription>
                    Review, fix, or remove saved context before AI generates the next project brief version.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(evidenceTypeCounts).length > 0 ? (
                      Object.entries(evidenceTypeCounts).map(([type, count]) => (
                        <div key={type} className="rounded-md border px-3 py-2">
                          <p className="text-lg font-semibold">{count}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {type.replace("_", " ")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                        No Capture evidence saved yet.
                      </div>
                    )}
                  </div>
                  {captureEvidence.length > 0 ? (
                    <div className="space-y-2">
                      {captureEvidence.slice(-8).reverse().map((item) => (
                        <div key={item.id} className="rounded-md border p-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {item.evidence_type.replace("_", " ")}
                              </Badge>
                              {item.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[9px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingEvidence(item)}
                                aria-label="Edit context item"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => void deleteEvidenceItem(item.id)}
                                aria-label="Delete context item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {editingEvidenceId === item.id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editingEvidenceContent}
                                onChange={(event) => setEditingEvidenceContent(event.target.value)}
                                rows={4}
                              />
                              <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={() => void saveEvidenceEdit()}>
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingEvidenceId(null);
                                    setEditingEvidenceContent("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm leading-relaxed">{previewText(item.content)}</p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {item.source || "Capture context"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      Saved context items will appear here.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="technologies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Technologies</CardTitle>
              <CardDescription>
                Add the technologies this customer wants to use so CORE can tailor discovery
                questions from the start.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  value={technologyInput}
                  onChange={(e) => setTechnologyInput(e.target.value)}
                  placeholder="Technology, e.g., Microsoft Fabric"
                  rows={1}
                />
                <Textarea
                  value={technologyFocusInput}
                  onChange={(e) => setTechnologyFocusInput(e.target.value)}
                  placeholder="Specific focus, e.g., Ontologies"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void addTechnology();
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    void addTechnology();
                  }}
                  disabled={savingTechnologies || !technologyInput.trim()}
                  className="self-start"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {technologyTargets.length > 0 && (
                <div className="space-y-2">
                  {technologyTargets.map((target) => (
                    <div
                      key={`${target.name}::${target.focus}`}
                      className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
                    >
                      <Badge variant="secondary" className="px-2 py-1">
                        {target.name}
                      </Badge>
                      {target.focus && (
                        <Badge variant="outline" className="px-2 py-1">
                          Focus: {target.focus}
                        </Badge>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${target.name}`}
                        className="inline-flex items-center"
                        onClick={() => {
                          void removeTechnology(target.name, target.focus);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paste Transcript</CardTitle>
              <CardDescription>
                Paste meeting notes, interview notes, call transcripts, or workshop transcripts as raw context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={transcriptSource}
                onChange={(e) => setTranscriptSource(e.target.value)}
                placeholder="Source, meeting, speaker, or transcript label"
              />
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here..."
                rows={8}
              />
              <Button onClick={saveTranscript} disabled={savingTranscript || !transcript.trim()}>
                {savingTranscript ? "Saving..." : "Save Transcript"}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
