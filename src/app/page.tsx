"use client";

import { useEffect, useState } from "react";
import { Search, Compass, Lightbulb, Rocket, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDiscovery } from "@/stores/discovery-store";
import type { DiscoveryMode } from "@/types/core";
import { MODE_CONFIG, PHASE_CONFIG } from "@/types/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DocsPathConfig } from "@/components/settings/docs-path-config";
import { EngagementConfig } from "@/components/settings/engagement-config";
import { api } from "@/lib/api";

const PHASE_ICONS = {
  capture: Search,
  orient: Compass,
  refine: Lightbulb,
  execute: Rocket,
} as const;

const PHASE_COLORS = {
  capture: "border-blue-500/30 bg-blue-500/5",
  orient: "border-amber-500/30 bg-amber-500/5",
  refine: "border-emerald-500/30 bg-emerald-500/5",
  execute: "border-violet-500/30 bg-violet-500/5",
} as const;

export default function DashboardPage() {
  const { discoveries, loadDiscoveries, createDiscovery, setActiveDiscovery, activeDiscovery, loading } = useDiscovery();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<DiscoveryMode>("standard");
  const [docsPath, setDocsPath] = useState("");
  const [engagementPath, setEngagementPath] = useState("");

  useEffect(() => {
    loadDiscoveries().catch(() => {});
  }, [loadDiscoveries]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createDiscovery({ name, description, mode, docs_path: docsPath, engagement_repo_path: engagementPath });
    setName("");
    setDescription("");
    setDocsPath("");
    setEngagementPath("");
    setOpen(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              New Discovery
          </DialogTrigger>
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
      </div>

      {/* CORE Phase Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["capture", "orient", "refine", "execute"] as const).map((phase) => {
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
      <div>
        <h2 className="text-lg font-semibold mb-3">Active Discoveries</h2>
        {discoveries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-muted-foreground text-sm">
                No discoveries yet. Start one to begin your CORE journey.
              </p>
              <Button
                variant="outline"
                className="mt-4"
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
                      <CardTitle className="text-base">{d.name}</CardTitle>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <PhaseIcon className="h-3 w-3" />
                        {phaseConfig.label}
                      </Badge>
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
                      <span>
                        {d.evidence?.length || 0} evidence items
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Engagement repo config for active discovery */}
      {activeDiscovery && (
        <EngagementConfig
          discovery={activeDiscovery}
          onUpdate={(patch) => {
            api.discoveries.update(activeDiscovery.id, patch).then((updated) => {
              setActiveDiscovery(updated);
            }).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
