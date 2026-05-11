"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FolderGit2,
  Loader2,
  AlertCircle,
  FileText,
  FolderOpen,
  Layers,
  BookOpen,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import type { EngagementContentResult } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { EngagementContentViewer } from "@/components/context/engagement-content-viewer";
import { IngestPanel } from "@/components/context/ingest-panel";

export default function ContextPage() {
  const { activeDiscovery } = useDiscovery();
  const [path, setPath] = useState(
    activeDiscovery?.engagement_repo_paths?.[0] || activeDiscovery?.engagement_repo_path || "",
  );
  const [data, setData] = useState<EngagementContentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");

  const loadContent = useCallback(async (repoPath: string) => {
    if (!repoPath.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.engagement.content(repoPath.trim());
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load content");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load when discovery has an engagement path
  useEffect(() => {
    const primaryPath =
      activeDiscovery?.engagement_repo_paths?.[0] || activeDiscovery?.engagement_repo_path || "";
    if (primaryPath) {
      setPath(primaryPath);
      loadContent(primaryPath);
    }
  }, [activeDiscovery?.engagement_repo_path, activeDiscovery?.engagement_repo_paths, loadContent]);

  // Reload after ingest writes a file
  const handleFileWritten = useCallback(() => {
    if (path.trim()) loadContent(path.trim());
  }, [path, loadContent]);

  // Stats for the overview cards
  const stats = data
    ? {
        files: data.content.length,
        projects: data.projects.length,
        types: new Set(data.content.map((f) => f.type)).size,
      }
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Tools"
        title="Engagement Context"
        description="Browse, search, and ingest content from your engagement knowledge base."
        icon={FolderGit2}
        actions={
          data && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Connected
            </Badge>
          )
        }
      />

      {/* Path Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Engagement Repository</CardTitle>
          <CardDescription>
            Path to the engagement repo on your filesystem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              loadContent(path);
            }}
          >
            <Input
              placeholder="/path/to/engagement-repo"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button type="submit" disabled={loading || !path.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Load"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Content Area */}
      {data && (
        <>
          {/* Stats Row */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={FileText}
                label="Files"
                value={stats.files}
                color="text-muted-foreground bg-muted"
              />
              <StatCard
                icon={FolderOpen}
                label="Projects"
                value={stats.projects}
                color="text-muted-foreground bg-muted"
              />
              <StatCard
                icon={Layers}
                label="Content Types"
                value={stats.types}
                color="text-muted-foreground bg-muted"
              />
            </div>
          )}

          <Separator />

          {/* Browse / Ingest Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="browse" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Browse Content
              </TabsTrigger>
              <TabsTrigger value="ingest" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Ingest New
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-4">
              <EngagementContentViewer data={data} />
            </TabsContent>

            <TabsContent value="ingest" className="mt-4">
              <IngestPanel repoPath={path} onFileWritten={handleFileWritten} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-6 w-10 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <EmptyState
          icon={FolderGit2}
          title="No repo loaded"
          description="Enter the path to your engagement repo above to browse content, search across files, and ingest new information."
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardContent className="flex items-center gap-3 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
