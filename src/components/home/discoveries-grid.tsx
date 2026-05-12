"use client";

import { Pencil, Search, Compass, Lightbulb, Rocket, Trash2, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CorePhase, Discovery } from "@/types/core";
import { MODE_CONFIG, PHASE_CONFIG } from "@/types/core";

const PHASE_ICONS: Record<CorePhase, LucideIcon> = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
};

export interface DiscoveriesGridProps {
  discoveries: Discovery[];
  activeId: string | undefined;
  deletingId: string;
  onPick: (d: Discovery) => void;
  onEdit: (d: Discovery) => void;
  onDelete: (d: Discovery) => void;
}

/** Card grid of discoveries on the dashboard. Renders empty hint when
 *  the list is empty (the page handles the cold-start EmptyState
 *  separately when no discoveries exist at all). */
export function DiscoveriesGrid({
  discoveries,
  activeId,
  deletingId,
  onPick,
  onEdit,
  onDelete,
}: DiscoveriesGridProps) {
  if (discoveries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No other discoveries — start a new one above to add another track.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {discoveries.map((d) => {
        const phaseConfig = PHASE_CONFIG[d.current_phase];
        const PhaseIcon = PHASE_ICONS[d.current_phase];
        const isActive = activeId === d.id;
        return (
          <Card
            key={d.id}
            className={`relative cursor-pointer overflow-hidden rounded-xl bg-card border transition-all duration-200 hover:shadow-lg hover:border-foreground/20 hover:-translate-y-0.5 ${isActive ? "ring-2 ring-brand" : ""}`}
            onClick={() => onPick(d)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base pr-2 leading-snug">{d.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                    <PhaseIcon className="h-3 w-3" aria-hidden />
                    {phaseConfig.label}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(d);
                    }}
                    aria-label={`Edit ${d.name}`}
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === d.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(d);
                    }}
                    aria-label={`Delete ${d.name}`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </Button>
                </div>
              </div>
              {d.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {MODE_CONFIG[d.mode].label}
                </Badge>
                <span>{d.evidence?.length ?? 0} evidence items</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
