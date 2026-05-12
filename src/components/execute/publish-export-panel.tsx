"use client";

import { Archive, FileJson, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionPanel } from "@/components/execute/action-panel";
import type { EngagementPublishResult, SolutionBlueprint } from "@/types/core";

interface PublishExportPanelProps {
  latestBlueprint: SolutionBlueprint | undefined;
  blueprintBusy: boolean;
  publishBusy: boolean;
  publishResult: EngagementPublishResult | null;
  connectedSources: string[];
  error: string | null;
  onGenerateBlueprint: () => void;
  onRunPublish: (dryRun: boolean) => void;
  onDownloadDiscovery: (format: "json" | "csv") => void;
}

export function PublishExportPanel({
  latestBlueprint,
  blueprintBusy,
  publishBusy,
  publishResult,
  connectedSources,
  error,
  onGenerateBlueprint,
  onRunPublish,
  onDownloadDiscovery,
}: PublishExportPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Archive className="h-4 w-4 text-violet-500" />Publish & Export
        </CardTitle>
        <CardDescription>Package approved outputs, create the final blueprint, and export the discovery record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <ActionPanel
            title="Solution Blueprint"
            description={latestBlueprint?.approach_title || "Generate or refresh the candidate architecture package."}
          >
            <Button size="sm" onClick={onGenerateBlueprint} disabled={blueprintBusy}>
              {blueprintBusy ? "Generating..." : latestBlueprint ? "Regenerate Blueprint" : "Generate Blueprint"}
            </Button>
          </ActionPanel>
          <ActionPanel
            title="Repo Publish"
            description={connectedSources.length > 0 ? `${connectedSources.length} connected source(s)` : "Connect a source on Capture before publishing."}
          >
            <Button size="sm" variant="outline" onClick={() => onRunPublish(true)} disabled={publishBusy || connectedSources.length === 0}>Plan Publish</Button>
            <Button size="sm" onClick={() => onRunPublish(false)} disabled={publishBusy || connectedSources.length === 0}>Publish</Button>
          </ActionPanel>
          <ActionPanel
            title="Discovery Export"
            description="Download the source-of-truth discovery record and evidence table."
          >
            <Button size="sm" variant="outline" onClick={() => onDownloadDiscovery("json")}>
              <FileJson className="mr-1.5 h-3.5 w-3.5" />JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDownloadDiscovery("csv")}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />CSV
            </Button>
          </ActionPanel>
        </div>

        {latestBlueprint && (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Blueprint v{latestBlueprint.version}</Badge>
              <p className="text-sm font-semibold">{latestBlueprint.approach_title}</p>
            </div>
            <p className="text-sm text-muted-foreground">{latestBlueprint.approach_summary}</p>
            <p className="text-xs"><span className="font-medium">First outcome:</span> {latestBlueprint.quick_win_suggestion}</p>
          </div>
        )}

        {publishResult && (
          <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
            <p className="font-medium">{publishResult.dry_run ? "Publish plan" : "Publish complete"}: {publishResult.count} item(s)</p>
            <p className="text-xs text-muted-foreground">Skipped: {publishResult.skipped.length} | Errors: {publishResult.errors.length}</p>
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
