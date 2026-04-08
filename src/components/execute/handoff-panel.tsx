"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { QuickWin, Blocker } from "@/types/core";

interface HandoffPanelProps {
  wins: QuickWin[];
  blockers: Blocker[];
  handoffNotes: string;
  onNotesChange: (notes: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function HandoffPanel({ wins, blockers, handoffNotes, onNotesChange, onSave, saving }: HandoffPanelProps) {
  const hasCriticalBlockers = blockers.some((b) => !b.resolved && b.severity === "critical");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RPI Handoff Package</CardTitle>
        <CardDescription>
          Summarize findings, recommendations, and next steps for the implementation team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-emerald-500/20">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wider text-emerald-600 font-medium mb-1">Validated</p>
              <p className="text-2xl font-bold">{wins.filter((w) => w.done).length} wins</p>
              <p className="text-xs text-muted-foreground">delivered and confirmed</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wider text-amber-600 font-medium mb-1">Open</p>
              <p className="text-2xl font-bold">{blockers.filter((b) => !b.resolved).length} blockers</p>
              <p className="text-xs text-muted-foreground">requiring attention</p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div>
          <label className="text-sm font-medium">Handoff Notes &amp; Recommendations</label>
          <Textarea value={handoffNotes} onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Summarize: what was discovered, what was validated, what the team should build next, and any caveats..."
            rows={6} />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Notes"}
          </Button>
          <Button className="flex-1" disabled={hasCriticalBlockers}>
            {hasCriticalBlockers
              ? "Resolve Critical Blockers Before Handoff"
              : "Generate Handoff Document"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
