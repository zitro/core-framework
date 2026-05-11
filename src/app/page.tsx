"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDiscovery } from "@/stores/discovery-store";
import type { DiscoveryMode } from "@/types/core";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ActiveDiscoveryHero } from "@/components/home/active-discovery-hero";
import { DiscoveriesGrid } from "@/components/home/discoveries-grid";
import { EditDiscoveryDialog } from "@/components/home/edit-discovery-dialog";
import { NewDiscoveryDialog } from "@/components/home/new-discovery-dialog";
import { PhaseOverview } from "@/components/home/phase-overview";
import { useProject } from "@/stores/project-store";

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

      <PhaseOverview />

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

      <NewDiscoveryDialog
        open={open}
        onOpenChange={handleOpenChange}
        name={name}
        description={description}
        mode={mode}
        docsPath={docsPath}
        engagementPath={engagementPath}
        loading={loading}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onModeChange={setMode}
        onDocsPathChange={setDocsPath}
        onEngagementPathChange={setEngagementPath}
        onCreate={handleCreate}
      />

      <EditDiscoveryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        name={editName}
        description={editDescription}
        saving={savingEdit}
        onNameChange={setEditName}
        onDescriptionChange={setEditDescription}
        onSave={handleSaveEdit}
      />

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
