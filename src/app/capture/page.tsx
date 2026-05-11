"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  FolderGit2,
  HelpCircle,
  Lightbulb,
  Link as LinkIcon,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Quote,
  ScrollText,
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
import { useTabParam } from "@/lib/use-tab-param";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";
import { DiscoveryRequired } from "@/components/layout/discovery-required";
import { EngagementConfig } from "@/components/settings/engagement-config";
import { BrowsePanel } from "@/components/capture/discover/browse-panel";
import { CompanyResearchPanel } from "@/components/capture/discover/company-research-panel";
import { M365Panel } from "@/components/capture/discover/m365-panel";
import { WebSearchPanel } from "@/components/capture/discover/web-search-panel";

interface CaptureDraft {
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
  | "transcript"
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
    value: "transcript",
    label: "Transcript",
    description: "Meeting notes, interview transcripts, calls, or workshops.",
    placeholder: "Paste the full transcript here. Source / speaker goes in the reference field below.",
    source: "Transcript",
    evidenceType: "general",
    tags: ["transcript", "raw-context"],
    icon: ScrollText,
    methodIds: ["stakeholder-interviews"],
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
  const [activeTab, setActiveTab] = useTabParam("sources");

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="technologies">Technologies</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <section className="relative overflow-hidden rounded-xl border bg-card">
            <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-brand" aria-hidden />
            <div className="space-y-2 px-6 py-5 sm:px-8">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <FolderGit2 className="h-3.5 w-3.5" />
                <span>Anchor — start here</span>
              </div>
              <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                Connect your engagement repo
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Sources is where CORE gets its facts. Point it at the engagement repo, register external connectors,
                and the rest of Capture, Orchestrate, Refine, and Execute work from that ground truth.
              </p>
            </div>
          </section>
          <EngagementConfig
            discovery={activeDiscovery}
            onUpdate={(patch) => {
              api.discoveries.update(activeDiscovery.id, patch).then((updated) => {
                setActiveDiscovery(updated);
              }).catch(() => {});
            }}
          />
          <BrowsePanel hidePathInput />
        </TabsContent>

        <TabsContent value="context" className="space-y-4">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void addQuickNote("save");
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
                    if (canSaveContext && !savingNote) void addQuickNote("save");
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
                  onChange={(e) => void onSelectEvidenceFiles(e.target.files)}
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
                        onClick={() =>
                          setPendingFiles((prev) =>
                            prev.filter((item) => !(item.name === file.name && item.size === file.size)),
                          )
                        }
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
                    onClick={() => void addQuickNote("add-another")}
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

            <aside className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Captured
                </p>
                <p className="font-heading text-3xl font-semibold tabular-nums">
                  {captureEvidence.length}
                </p>
              </div>

              {Object.entries(evidenceTypeCounts).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(evidenceTypeCounts).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-[10px] capitalize">
                      {type.replace("_", " ")} · {count}
                    </Badge>
                  ))}
                </div>
              )}

              {captureEvidence.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Saved items will appear here as you capture.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {captureEvidence
                    .slice(-8)
                    .reverse()
                    .map((item) => (
                      <div
                        key={item.id}
                        className="group border-l-2 border-muted py-0.5 pl-3 transition-colors hover:border-brand/60"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {item.evidence_type.replace("_", " ")}
                            </span>
                            {item.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="text-[10px] text-muted-foreground/70">
                                · {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => startEditingEvidence(item)}
                              aria-label="Edit context item"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => void deleteEvidenceItem(item.id)}
                              aria-label="Delete context item"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {editingEvidenceId === item.id ? (
                          <div className="mt-1 space-y-1.5">
                            <Textarea
                              value={editingEvidenceContent}
                              onChange={(event) => setEditingEvidenceContent(event.target.value)}
                              rows={3}
                              className="text-xs"
                            />
                            <div className="flex gap-1.5">
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
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-foreground/80">
                            {previewText(item.content)}
                          </p>
                        )}
                        {item.source && (
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {item.source}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </aside>
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

        <TabsContent value="discover" className="space-y-4">
          <Tabs defaultValue="web" className="space-y-4">
            <TabsList>
              <TabsTrigger value="web">Web Search</TabsTrigger>
              <TabsTrigger value="m365">Microsoft 365</TabsTrigger>
              <TabsTrigger value="company">Company Research</TabsTrigger>
            </TabsList>
            <TabsContent value="web">
              <WebSearchPanel />
            </TabsContent>
            <TabsContent value="m365">
              <M365Panel />
            </TabsContent>
            <TabsContent value="company">
              <CompanyResearchPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
