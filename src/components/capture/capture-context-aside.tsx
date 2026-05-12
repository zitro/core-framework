"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Evidence } from "@/types/core";

interface Props {
  captureEvidence: Evidence[];
  evidenceTypeCounts: Record<string, number>;
  editingEvidenceId: string | null;
  editingEvidenceContent: string;
  setEditingEvidenceContent: (v: string) => void;
  cancelEditing: () => void;
  startEditingEvidence: (item: Evidence) => void;
  saveEvidenceEdit: () => void;
  deleteEvidenceItem: (id: string) => void;
}

function previewText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

export function CaptureContextAside({
  captureEvidence,
  evidenceTypeCounts,
  editingEvidenceId,
  editingEvidenceContent,
  setEditingEvidenceContent,
  cancelEditing,
  startEditingEvidence,
  saveEvidenceEdit,
  deleteEvidenceItem,
}: Props): React.ReactElement {
  return (
    <aside className="space-y-4">
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Captured
        </p>
        <p className="font-heading text-3xl font-semibold tabular-nums">
          {captureEvidence.length}
        </p>
      </div>

      {Object.entries(evidenceTypeCounts).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(evidenceTypeCounts).map(([type, count]) => (
            <Badge key={type} variant="outline" className="text-[10px] capitalize">
              {type.replace("_", " ")} · {count}
            </Badge>
          ))}
        </div>
      )}

      {captureEvidence.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Saved items will appear here as you capture.
        </p>
      ) : (
        <div className="space-y-2.5">
          {captureEvidence
            .slice(-8)
            .reverse()
            .map((item) => (
              <div
                key={item.id}
                className="group border-l-2 border-muted py-0.5 pl-3 transition-colors hover:border-brand/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {item.evidence_type.replace("_", " ")}
                    </span>
                    {item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] text-muted-foreground/70">
                        · {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => startEditingEvidence(item)}
                      aria-label="Edit context item"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => deleteEvidenceItem(item.id)}
                      aria-label="Delete context item"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {editingEvidenceId === item.id ? (
                  <div className="mt-1 space-y-1.5">
                    <Textarea
                      value={editingEvidenceContent}
                      onChange={(event) => setEditingEvidenceContent(event.target.value)}
                      rows={3}
                      className="text-xs"
                    />
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" onClick={saveEvidenceEdit}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-foreground/80">
                    {previewText(item.content)}
                  </p>
                )}
                {item.source && (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {item.source}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}
    </aside>
  );
}
