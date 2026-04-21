"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderGit2, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { EngagementContentResult } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { EngagementContentViewer } from "@/components/context/engagement-content-viewer";

export default function ContextPage() {
  const { activeDiscovery } = useDiscovery();
  const [path, setPath] = useState(activeDiscovery?.engagement_repo_path || "");
  const [data, setData] = useState<EngagementContentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (activeDiscovery?.engagement_repo_path) {
      setPath(activeDiscovery.engagement_repo_path);
      loadContent(activeDiscovery.engagement_repo_path);
    }
  }, [activeDiscovery?.engagement_repo_path, loadContent]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
          <FolderGit2 className="h-5 w-5 text-teal-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Engagement Context
          </h1>
          <p className="text-muted-foreground text-sm">
            Read-only view of your engagement knowledge base
          </p>
        </div>
      </div>

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
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {data && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="text-sm">{data.content_name || "Unknown"}</Badge>
            <span className="text-sm text-muted-foreground">
              {data.content.length} files across {data.projects.length} project
              {data.projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          <Separator />

          <EngagementContentViewer data={data} />
        </>
      )}
    </div>
  );
}
