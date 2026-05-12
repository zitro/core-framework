"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { QuickWin } from "@/types/core";

interface FinalWinsPanelProps {
  wins: QuickWin[];
  onAdd: (win: Omit<QuickWin, "id" | "done">) => void;
  onToggle: (id: string) => void;
}

export function FinalWinsPanel({ wins, onAdd, onToggle }: FinalWinsPanelProps) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [impact, setImpact] = useState<QuickWin["impact"]>("high");

  const addFinalWin = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), owner: owner.trim(), impact, effort: "low" });
    setTitle("");
    setOwner("");
    setImpact("high");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Final Wins
        </CardTitle>
        <CardDescription>
          State the actual wins, outcomes, or confirmed value that should appear in final outputs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_150px_auto]">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Confirmed win or outcome"
            onKeyDown={(event) => event.key === "Enter" && addFinalWin()}
          />
          <select
            value={impact}
            onChange={(event) => setImpact(event.target.value as QuickWin["impact"])}
            className="flex h-9 rounded-md border bg-background px-3 text-sm"
            title="Final win impact"
          >
            <option value="high">High impact</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner" />
          <Button size="sm" onClick={addFinalWin}>Add</Button>
        </div>

        {wins.length > 0 ? (
          <div className="space-y-2">
            {wins.map((win) => (
              <div key={win.id} className="flex items-center gap-3 rounded-md border p-3">
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onToggle(win.id)}>
                  <CheckCircle2 className={`h-4 w-4 ${win.done ? "text-emerald-500" : "text-muted-foreground"}`} />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${win.done ? "" : "text-muted-foreground"}`}>{win.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {win.done ? "Confirmed for final outputs" : "Draft win, confirm before final package"}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">{win.impact} impact</Badge>
                {win.owner && <Badge variant="secondary" className="text-[10px]">{win.owner}</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No final wins have been set yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
