"use client";

import { Folder, FolderSearch, Link, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  EngagementSource,
  EngagementSourceType,
  EngagementSourceUpdateStatus,
} from "@/types/core";
import { sourceAlias } from "./engagement-helpers";

interface EngagementConnectedSourcesProps {
  connectedSources: EngagementSource[];
  scanningType: EngagementSourceType | null;
  deletingSourceKey: string | null;
  updateStatuses: EngagementSourceUpdateStatus[];
  onSelect: (source: EngagementSource) => void;
  onRemove: (source: EngagementSource) => void;
}

export function EngagementConnectedSources({
  connectedSources,
  scanningType,
  deletingSourceKey,
  updateStatuses,
  onSelect,
  onRemove,
}: EngagementConnectedSourcesProps) {
  return (
    <>
      {connectedSources.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Connected sources</div>
          <div className="space-y-1.5">
            {connectedSources.map((source, index) => (
              <div key={`${source.type}:${source.value}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {source.type === "repository" ? (
                    <span className="inline-flex items-center gap-1"><Link className="h-3 w-3" />Repo</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><Folder className="h-3 w-3" />Local</span>
                  )}
                </Badge>
                <code className="min-w-0 flex-1 truncate text-xs">{source.value}</code>
                {index === 0 && (
                  <Badge variant="secondary" className="text-[10px]">Primary</Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelect(source)}
                  disabled={scanningType !== null}
                >
                  <FolderSearch className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(source)}
                  disabled={deletingSourceKey === `${source.type}:${source.value}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {updateStatuses.length > 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
          <div className="font-medium">Source update status</div>
          <ul className="space-y-1 text-xs text-muted-foreground max-h-40 overflow-y-auto">
            {updateStatuses.map((status) => {
              let label: string;
              if (status.error) {
                label = `error (${status.error})`;
              } else if (status.changed) {
                label = "updated";
              } else {
                label = "no changes";
              }
              return (
                <li key={`${status.type}:${status.value}`}>
                  • {sourceAlias(status.value)}: {label} — {status.file_count} files
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
