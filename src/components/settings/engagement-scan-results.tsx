"use client";

import { CheckCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type {
  EngagementExportResult,
  EngagementPublishResult,
  EngagementScanResult,
  EngagementSource,
} from "@/types/core";
import { sourceAlias, type SourceDuplicate, type SourceVersionGroup } from "./engagement-helpers";

interface EngagementScanResultsProps {
  scan: EngagementScanResult | null;
  exporting: boolean;
  planning: boolean;
  analyzingSources: boolean;
  exportResult: EngagementExportResult | null;
  planResult: EngagementPublishResult | null;
  sourceDuplicates: SourceDuplicate[];
  sourceVersions: SourceVersionGroup[];
  connectedSources: EngagementSource[];
}

function automationStatusLabel(
  exporting: boolean,
  planning: boolean,
  analyzingSources: boolean,
): string {
  if (exporting) return "Auto-exporting CORE artifacts";
  if (planning) return "Auto planning publish across connected sources";
  if (analyzingSources) return "AI analyzing cross-source duplicates and versions";
  return "Auto export + plan publish + source analysis complete";
}

export function EngagementScanResults({
  scan,
  exporting,
  planning,
  analyzingSources,
  exportResult,
  planResult,
  sourceDuplicates,
  sourceVersions,
  connectedSources,
}: EngagementScanResultsProps) {
  if (scan?.error) {
    return <p className="text-sm text-destructive">{scan.error}</p>;
  }
  if (!scan || scan.error) return null;

  const fileTypeCounts = scan.files.reduce<Record<string, number>>((acc, f) => {
    const t = f.type || "other";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const showAnalysis =
    sourceDuplicates.length > 0 || sourceVersions.length > 0 || connectedSources.length > 1;

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          <span className="font-medium">{scan.content_name}</span>
          <Badge variant="outline" className="text-xs">
            {scan.files.length} files
          </Badge>
        </div>

        {scan.projects.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Projects:{" "}
            {scan.projects.map((i) => (
              <Badge key={i} variant="secondary" className="mr-1 text-xs">
                {i}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {Object.entries(fileTypeCounts).map(([type, count]) => (
            <Badge key={type} variant="outline" className="text-xs">
              {type}: {count}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <FileText className="mr-1 inline h-3.5 w-3.5" />
          {automationStatusLabel(exporting, planning, analyzingSources)}
        </div>
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

      {planResult && (
        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
          <div className="font-medium">
            Auto plan publish: {planResult.count} items
          </div>
          <div className="text-xs text-muted-foreground">
            Skipped: {planResult.skipped.length} | Errors: {planResult.errors.length}
          </div>
        </div>
      )}

      {showAnalysis && (
        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
          <div className="font-medium">Cross-source analysis</div>
          {sourceDuplicates.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Duplicate groups (not re-ingested)
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                {sourceDuplicates.slice(0, 20).map((dup) => (
                  <li key={dup.key}>
                    • {dup.type || "other"} | {dup.title} | sources: {dup.sources.map(sourceAlias).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No duplicate items detected across current sources.</div>
          )}

          {sourceVersions.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Multi-version findings (showing provenance)
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground max-h-40 overflow-y-auto">
                {sourceVersions.slice(0, 20).map((group) => (
                  <li key={group.key}>
                    <div>• {group.type || "other"} | {group.title}</div>
                    {group.entries.map((entry) => (
                      <div key={`${entry.source}:${entry.path}`} className="pl-3">
                        - {sourceAlias(entry.source)} :: {entry.path}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
