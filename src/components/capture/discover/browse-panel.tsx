"use client";

/**
 * BrowsePanel — engagement-repo file browser + ingest.
 *
 * Lifted from the deleted ``/context`` route. Keeps the route's internal
 * Browse Content / Ingest New tabs so behavior is unchanged.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  FileText,
  FolderGit2,
  FolderOpen,
  Layers,
  Loader2,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/layout/empty-state";
import { EngagementContentViewer } from "@/components/context/engagement-content-viewer";
import { IngestPanel } from "@/components/context/ingest-panel";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import type { EngagementContentResult } from "@/types/core";

interface BrowsePanelProps {
  /** When true, hide the path input — caller is rendering us alongside an
   * EngagementConfig (Sources tab) that already owns path entry. */
  hidePathInput?: boolean;
}

export function BrowsePanel({ hidePathInput = false }: BrowsePanelProps = {}) {
  const { activeDiscovery } = useDiscovery();
  const [path, setPath] = useState(
    activeDiscovery?.engagement_repo_paths?.[0] ||
      activeDiscovery?.engagement_repo_path ||
      "",
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

  useEffect(() => {
    const primaryPath =
      activeDiscovery?.engagement_repo_paths?.[0] ||
      activeDiscovery?.engagement_repo_path ||
      "";
    if (primaryPath) {
      setPath(primaryPath);
      loadContent(primaryPath);
    }
  }, [
    activeDiscovery?.engagement_repo_path,
    activeDiscovery?.engagement_repo_paths,
    loadContent,
  ]);

  const handleFileWritten = useCallback(() => {
    if (path.trim()) loadContent(path.trim());
  }, [path, loadContent]);

  const stats = data
    ? {
        files: data.content.length,
        projects: data.projects.length,
        types: new Set(data.content.map((f) => f.type)).size,
      }
    : null;

  return (
    <div className="space-y-4">
      {!hidePathInput && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Engagement Repository</CardTitle>
                <CardDescription>
                  Path to the engagement repo on your filesystem
                </CardDescription>
              </div>
              {data && (
                <Badge variant="outline" className="gap-1.5 px-2 py-0.5 text-xs">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Connected
                </Badge>
              )}
            </div>
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={FileText} label="Files" value={stats.files} />
              <StatCard icon={FolderOpen} label="Projects" value={stats.projects} />
              <StatCard icon={Layers} label="Content Types" value={stats.types} />
            </div>
          )}

          <Separator />

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

      {loading && !data && (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-6 w-10 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
}: {
  icon: typeof FileText;
  label: string;
  value: number;
}) {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
