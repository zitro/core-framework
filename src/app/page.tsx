"use client";

import { useEffect, useState } from "react";
import { Search, Compass, Lightbulb, Rocket, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useDiscovery } from "@/stores/discovery-store";
import type { DiscoveryMode } from "@/types/core";
import { MODE_CONFIG, PHASE_CONFIG } from "@/types/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DocsPathConfig } from "@/components/settings/docs-path-config";
import { useProject } from "@/stores/project-store";

const PHASE_ICONS = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
} as const;

const PHASE_COLORS = {
  capture: "border-blue-500/30 bg-blue-500/5",
  orchestrate: "border-amber-500/30 bg-amber-500/5",
  refine: "border-emerald-500/30 bg-emerald-500/5",
  execute: "border-violet-500/30 bg-violet-500/5",
} as const;

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

  useEffect(() => {
    if (!activeProject?.id) return;
    loadDiscoveries(activeProject.id).catch(() => {});
  }, [activeProject?.id, loadDiscoveries]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("newDiscovery") === "1") {
      setOpen(true);
    }

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

  const handleDelete = async (id: string, discoveryName: string) => {
    const shouldDelete = window.confirm(
      `Delete discovery \"${discoveryName}\"? This cannot be undone.`
    );
    if (!shouldDelete) return;
    setDeletingId(id);
    try {
      await deleteDiscovery(id);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CORE Discovery</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered product discovery coaching
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Start a New Discovery</DialogTitle>
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
                <label className="text-sm font-medium">Discovery Mode</label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {(Object.entries(MODE_CONFIG) as [DiscoveryMode, typeof MODE_CONFIG.standard][]).map(
                    ([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          mode === key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{config.label}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {config.duration}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {config.description}
                        </p>
                      </button>
                    )
                  )}
                </div>
              </div>
              <DocsPathConfig value={docsPath} onChange={setDocsPath} />
              <div>
                <label className="text-sm font-medium">Engagement Repo (optional)</label>
                <Input
                  value={engagementPath}
                  onChange={(e) => setEngagementPath(e.target.value)}
                  placeholder="/path/to/engagement-repo"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Path to a cloned engagement repo for note ingestion
                </p>
              </div>
              <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full">
                {loading ? "Creating..." : "Start Discovery"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Discovery</DialogTitle>
              <DialogDescription>
                Update the discovery name and description.
              </DialogDescription>
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
              <Button
                onClick={handleSaveEdit}
                disabled={!editName.trim() || savingEdit}
                className="w-full"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Platform Overview */}
      <Card className="border-border/70 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What This Platform Does</CardTitle>
          <CardDescription className="text-sm">
            CORE helps teams run disciplined discovery from first signals to execution-ready outcomes. Capture evidence, orchestrate insights, refine priorities, and execute with confidence in a single workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Evidence-Driven Decisions</Badge>
            <Badge variant="outline">AI-Assisted Discovery</Badge>
            <Badge variant="outline">Structured Delivery Flow</Badge>
          </div>
        </CardContent>
      </Card>

      {/* CORE Phase Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["capture", "orchestrate", "refine", "execute"] as const).map((phase) => {
          const config = PHASE_CONFIG[phase];
          const Icon = PHASE_ICONS[phase];
          return (
            <Link key={phase} href={`/${phase}`}>
              <Card
                className={`cursor-pointer hover:shadow-md transition-shadow border ${PHASE_COLORS[phase]}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">
                    {config.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>


      {/* Active Discoveries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Discoveries</h2>
          <Button size="sm" className="cursor-pointer" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Discovery
          </Button>
        </div>

        {discoveries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-muted-foreground text-sm">
                No discoveries yet. Start one to begin your CORE journey.
              </p>
              <Button
                variant="outline"
                className="mt-4 cursor-pointer"
                onClick={() => setOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Discovery
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {discoveries.map((d) => {
              const phaseConfig = PHASE_CONFIG[d.current_phase];
              const PhaseIcon = PHASE_ICONS[d.current_phase];
              const isActive = activeDiscovery?.id === d.id;
              return (
                <Card
                  key={d.id}
                  className={`hover:shadow-md transition-shadow cursor-pointer ${isActive ? "ring-2 ring-primary" : ""}`}
                  onClick={() => {
                    setActiveDiscovery(d);
                    router.push(`/${d.current_phase}`);
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base pr-2">{d.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <PhaseIcon className="h-3 w-3" />
                          {phaseConfig.label}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(d.id, d.name, d.description || "");
                          }}
                          aria-label={`Edit ${d.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={deletingId === d.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(d.id, d.name);
                          }}
                          aria-label={`Delete ${d.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      {d.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px]">
                        {MODE_CONFIG[d.mode].label}
                      </Badge>
                      <span>{d.evidence?.length || 0} evidence items</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
