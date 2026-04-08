"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Blocker } from "@/types/core";

const severityColor = {
  critical: "bg-red-500/10 text-red-500",
  major: "bg-amber-500/10 text-amber-500",
  minor: "bg-blue-500/10 text-blue-500",
};

interface BlockerListProps {
  blockers: Blocker[];
  onAdd: (blocker: Omit<Blocker, "id" | "resolved">) => void;
  onToggle: (id: string) => void;
}

export function BlockerList({ blockers, onAdd, onToggle }: BlockerListProps) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Blocker["severity"]>("major");
  const [mitigation, setMitigation] = useState("");

  const handleAdd = () => {
    if (!description.trim()) return;
    onAdd({ description, severity, mitigation });
    setDescription("");
    setMitigation("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Blocker Remediation</CardTitle>
        <CardDescription>
          Track blockers and their mitigations. Critical blockers block handoff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the blocker" className="flex-1" />
            <select value={severity} onChange={(e) => setSeverity(e.target.value as Blocker["severity"])}
              className="rounded-md border px-3 text-sm" title="Blocker severity">
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Input value={mitigation} onChange={(e) => setMitigation(e.target.value)}
              placeholder="Mitigation plan" className="flex-1" />
            <Button onClick={handleAdd} size="sm">Add</Button>
          </div>
        </div>

        {blockers.length > 0 && (
          <div className="space-y-2">
            {[...blockers]
              .sort((a, b) => ({ critical: 0, major: 1, minor: 2 }[a.severity] - { critical: 0, major: 1, minor: 2 }[b.severity]))
              .map((b) => (
                <div key={b.id} className={`p-3 rounded-lg border space-y-1 ${b.resolved ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onToggle(b.id)}>
                      <CheckCircle2 className={`h-4 w-4 ${b.resolved ? "text-emerald-500" : "text-muted-foreground"}`} />
                    </Button>
                    <Badge variant="outline" className={`border-0 ${severityColor[b.severity]}`}>
                      {b.severity}
                    </Badge>
                    <span className={`text-sm flex-1 ${b.resolved ? "line-through" : ""}`}>{b.description}</span>
                  </div>
                  {b.mitigation && (
                    <p className="text-xs text-muted-foreground ml-9">Mitigation: {b.mitigation}</p>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
