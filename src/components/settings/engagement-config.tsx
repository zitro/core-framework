"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  FolderSearch,
  Upload,
  CheckCircle,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Discovery, EngagementScanResult, EngagementExportResult } from "@/types/core";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface EngagementConfigProps {
  discovery: Discovery;
  onUpdate: (patch: Partial<Discovery>) => void;
}

export function EngagementConfig({ discovery, onUpdate }: EngagementConfigProps) {
  const [path, setPath] = useState(discovery.engagement_repo_path || "");
  const [scan, setScan] = useState<EngagementScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<EngagementExportResult | null>(null);

  const doScan = useCallback(async () => {
    if (!path.trim()) return;
    setScanning(true);
    setScan(null);
    try {
      const result = await api.engagement.scan(path.trim());
      setScan(result);
      if (result.customer_name) {
        onUpdate({ engagement_repo_path: path.trim() } as Partial<Discovery>);
      }
    } catch {
      /* toast handled by api */
    } finally {
      setScanning(false);
    }
  }, [path, onUpdate]);

  const doExport = useCallback(async () => {
    if (!discovery.id || !path.trim()) return;
    setExporting(true);
    setExportResult(null);
    try {
      const result = await api.engagement.export({
        discovery_id: discovery.id,
        engagement_repo_path: path.trim(),
      });
      setExportResult(result);
      toast.success(`Exported ${result.count} files`);
    } catch {
      /* toast handled by api */
    } finally {
      setExporting(false);
    }
  }, [discovery.id, path]);

  // Auto-scan if path is already set
  useEffect(() => {
    if (discovery.engagement_repo_path && !scan) {
      setPath(discovery.engagement_repo_path);
      api.vertex
        .scan(discovery.engagement_repo_path)
        .then(setScan)
        .catch(() => {});
    }
  }, [discovery.engagement_repo_path, scan]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          Engagement Repo Integration
        </CardTitle>
        <CardDescription>
          Link a structured markdown repo to feed engagement notes into AI
          context and export CORE outputs back.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Path input */}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="C:\Users\...\/path/to/engagement-repo"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={doScan}
            disabled={scanning || !path.trim()}
          >
            <FolderSearch className="mr-1.5 h-3.5 w-3.5" />
            {scanning ? "Scanning..." : "Scan"}
          </Button>
        </div>

        {/* Scan results */}
        {scan && !scan.error && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="font-medium">{scan.customer_name}</span>
                <Badge variant="outline" className="text-xs">
                  {scan.files.length} files
                </Badge>
              </div>

              {scan.initiatives.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Initiatives:{" "}
                  {scan.initiatives.map((i) => (
                    <Badge key={i} variant="secondary" className="mr-1 text-xs">
                      {i}
                    </Badge>
                  ))}
                </div>
              )}

              {/* File type breakdown */}
              <div className="flex flex-wrap gap-1">
                {Object.entries(
                  scan.files.reduce(
                    (acc, f) => {
                      const t = f.type || "other";
                      acc[t] = (acc[t] || 0) + 1;
                      return acc;
                    },
                    {} as Record<string, number>
                  )
                ).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Export */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <FileText className="mr-1 inline h-3.5 w-3.5" />
                Export problem statements, use cases, and blueprints to engagement
              </div>
              <Button
                size="sm"
                onClick={doExport}
                disabled={exporting || !discovery.id}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {exporting ? "Exporting..." : "Export"}
              </Button>
            </div>

            {exportResult && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <span className="font-medium">
                  {exportResult.count} files exported
                </span>{" "}
                to{" "}
                <code className="text-xs">{exportResult.target_dir}</code>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {exportResult.exported.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {scan?.error && (
          <p className="text-sm text-destructive">{scan.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
