"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { QuickWin } from "@/types/core";

const effortColor = { low: "text-emerald-500", medium: "text-amber-500", high: "text-red-500" };
const impactColor = { low: "text-muted-foreground", medium: "text-amber-500", high: "text-emerald-600" };

interface QuickWinTrackerProps {
  wins: QuickWin[];
  onAdd: (win: Omit<QuickWin, "id" | "done">) => void;
  onToggle: (id: string) => void;
}

export function QuickWinTracker({ wins, onAdd, onToggle }: QuickWinTrackerProps) {
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState<QuickWin["effort"]>("low");
  const [impact, setImpact] = useState<QuickWin["impact"]>("high");
  const [owner, setOwner] = useState("");

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({ title, effort, impact, owner });
    setTitle("");
    setOwner("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Win Tracker</CardTitle>
        <CardDescription>
          Focus on minimal-effort, high-impact actions that demonstrate value fast.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
          <div>
            <label className="text-xs font-medium">What</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quick win title"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          </div>
          <div>
            <label className="text-xs font-medium">Effort</label>
            <select value={effort} onChange={(e) => setEffort(e.target.value as QuickWin["effort"])}
              className="flex h-9 w-full rounded-md border px-3 text-sm" title="Effort level">
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Impact</label>
            <select value={impact} onChange={(e) => setImpact(e.target.value as QuickWin["impact"])}
              className="flex h-9 w-full rounded-md border px-3 text-sm" title="Impact level">
              <option value="high">High</option>
              <option value="medium">Med</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Owner</label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Name" className="w-28" />
          </div>
          <Button onClick={handleAdd} size="sm">Add</Button>
        </div>

        {wins.length > 0 && (
          <div className="space-y-2">
            {wins.map((w) => (
              <div key={w.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${w.done ? "bg-muted/50 opacity-60" : ""}`}>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onToggle(w.id)}>
                  <CheckCircle2 className={`h-4 w-4 ${w.done ? "text-emerald-500" : "text-muted-foreground"}`} />
                </Button>
                <span className={`text-sm flex-1 ${w.done ? "line-through" : ""}`}>{w.title}</span>
                <span className={`text-xs ${effortColor[w.effort]}`}>Effort: {w.effort}</span>
                <span className={`text-xs ${impactColor[w.impact]}`}>Impact: {w.impact}</span>
                {w.owner && <Badge variant="outline" className="text-xs">{w.owner}</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
