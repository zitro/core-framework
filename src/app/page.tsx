"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Compass,
  Lightbulb,
  Rocket,
  Plus,
  Pencil,
  Trash2,
  LayoutDashboard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDiscovery } from "@/stores/discovery-store";
import type { CorePhase, DiscoveryMode } from "@/types/core";
import { MODE_CONFIG, PHASE_CONFIG } from "@/types/core";
import { useRouter } from "next/navigation";
import { DocsPathConfig } from "@/components/settings/docs-path-config";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ActiveDiscoveryHero } from "@/components/home/active-discovery-hero";
import { useProject } from "@/stores/project-store";

const PHASE_ICONS: Record<CorePhase, LucideIcon> = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
};

export default function DashboardPage() {
  const {
    discoveries,
    loadDiscoveries,
    createDiscovery,
    setActiveDiscovery,
    updateDiscovery,
    deleteDiscovery,
    activeDiscovery,
    loading,
  } = useDiscovery();
  const { activeProject } = useProject();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<DiscoveryMode>("standard");
  const [docsPath, setDocsPath] = useState("");
  const [engagementPath, setEngagementPath] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!activeProject?.id) return;
    loadDiscoveries(activeProject.id).catch(() => {});
  }, [activeProject?.id, loadDiscoveries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("newDiscovery") === "1") setOpen(true);
    const onStartNewDiscovery = () => setOpen(true);
    window.addEventListener("core:start-new-discovery", onStartNewDiscovery);
    return () => {
      window.removeEventListener("core:start-new-discovery", onStartNewDiscovery);
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!nextOpen && params.get("newDiscovery") === "1") {
      router.replace("/", { scroll: false });
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createDiscovery({
      name,
      description,
      mode,
      docs_path: docsPath,
      engagement_repo_path: engagementPath,
      engagement_repo_paths: engagementPath.trim() ? [engagementPath.trim()] : [],
      project_id: activeProject?.id,
    });
    setName("");
    setDescription("");
    setDocsPath("");
    setEngagementPath("");
    setOpen(false);
  };

  const handleStartEdit = (id: string, currentName: string, currentDescription: string) => {
    setEditId(id);
    setEditName(currentName);
    setEditDescription(currentDescription);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateDiscovery(editId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditOpen(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteDiscovery(deleteTarget.id);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <PageHeader
        eyebrow="Dashboard"
        title="CORE Discovery"
        description="Pick up where you left off, or start a new discovery."
        icon={LayoutDashboard}
        accent="brand"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New discovery
          </Button>
        }
      />

      {activeDiscovery && <ActiveDiscoveryHero discovery={activeDiscovery} />}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {activeDiscovery ? "Other discoveries" : "Your discoveries"}
          </h2>
          {discoveries.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {discoveries.length} total
            </span>
          )}
        </div>

        {discoveries.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No discoveries yet"
            description="Start your first discovery to begin capturing evidence and synthesizing direction."
            actions={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create first discovery
              </Button>
            }
          />
        ) : (
          <DiscoveriesGrid
            discoveries={
              activeDiscovery
                ? discoveries.filter((d) => d.id !== activeDiscovery.id)
                : discoveries
            }
            activeId={activeDiscovery?.id}
            deletingId={deletingId}
            onPick={(d) => {
              setActiveDiscovery(d);
              router.push(`/${d.current_phase}`);
            }}
            onEdit={(d) => handleStartEdit(d.id, d.name, d.description || "")}
            onDelete={(d) => setDeleteTarget({ id: d.id, name: d.name })}
          />
        )}
      </section>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start a new discovery</DialogTitle>
            <DialogDescription>
              Choose a discovery mode and describe the engagement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Trading Platform Discovery"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you trying to discover?"
                rows={3}
                className="max-h-40 resize-y"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Discovery mode</label>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {(Object.entries(MODE_CONFIG) as [DiscoveryMode, typeof MODE_CONFIG.standard][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        mode === key
                          ? "border-brand bg-brand/5"
                          : "border-border hover:border-brand/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{config.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {config.duration}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
                    </button>
                  ),
                )}
              </div>
            </div>
            <DocsPathConfig value={docsPath} onChange={setDocsPath} />
            <div>
              <label className="text-sm font-medium">Engagement repo (optional)</label>
              <Input
                value={engagementPath}
                onChange={(e) => setEngagementPath(e.target.value)}
                placeholder="/path/to/engagement-repo"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Path to a cloned engagement repo for note ingestion.
              </p>
            </div>
            <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full">
              {loading ? "Creating..." : "Start discovery"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit discovery</DialogTitle>
            <DialogDescription>Update the discovery name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Trading Platform Discovery"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What are you trying to discover?"
                rows={3}
              />
            </div>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || savingEdit} className="w-full">
              {savingEdit ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete discovery?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}

interface DiscoveriesGridProps {
  discoveries: ReturnType<typeof useDiscovery>["discoveries"];
  activeId: string | undefined;
  deletingId: string;
  onPick: (d: DiscoveriesGridProps["discoveries"][number]) => void;
  onEdit: (d: DiscoveriesGridProps["discoveries"][number]) => void;
  onDelete: (d: DiscoveriesGridProps["discoveries"][number]) => void;
}

function DiscoveriesGrid({ discoveries, activeId, deletingId, onPick, onEdit, onDelete }: DiscoveriesGridProps) {
  if (discoveries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No other discoveries — start a new one above to add another track.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {discoveries.map((d) => {
        const phaseConfig = PHASE_CONFIG[d.current_phase];
        const PhaseIcon = PHASE_ICONS[d.current_phase];
        const isActive = activeId === d.id;
        return (
          <Card
            key={d.id}
            className={`cursor-pointer transition-shadow hover:shadow-md ${isActive ? "ring-2 ring-brand" : ""}`}
            onClick={() => onPick(d)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base pr-2 leading-snug">{d.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                    <PhaseIcon className="h-3 w-3" aria-hidden />
                    {phaseConfig.label}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(d);
                    }}
                    aria-label={`Edit ${d.name}`}
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === d.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(d);
                    }}
                    aria-label={`Delete ${d.name}`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </Button>
                </div>
              </div>
              {d.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {MODE_CONFIG[d.mode].label}
                </Badge>
                <span>{d.evidence?.length ?? 0} evidence items</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
