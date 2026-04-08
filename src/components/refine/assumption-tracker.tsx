"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Assumption } from "@/types/core";

const riskColor = { high: "text-red-500", medium: "text-amber-500", low: "text-emerald-500" };
const riskBg = { high: "bg-red-500/10", medium: "bg-amber-500/10", low: "bg-emerald-500/10" };

interface AssumptionTrackerProps {
  assumptions: Assumption[];
  onAssumptionsChange: (assumptions: Assumption[]) => void;
  context: string;
  onContextChange: (value: string) => void;
  generating: boolean;
  onGenerate: () => void;
  error: string | null;
  questions: { text: string; purpose: string; follow_ups: string[] }[];
}

export function AssumptionTracker({
  assumptions,
  onAssumptionsChange,
  context,
  onContextChange,
  generating,
  onGenerate,
  error,
  questions,
}: AssumptionTrackerProps) {
  const [newAssumption, setNewAssumption] = useState("");
  const [newRisk, setNewRisk] = useState<"high" | "medium" | "low">("medium");

  const addAssumption = () => {
    if (!newAssumption.trim()) return;
    const updated = [
      ...assumptions,
      { id: crypto.randomUUID(), text: newAssumption, risk: newRisk, status: "untested" as const },
    ];
    onAssumptionsChange(updated);
    setNewAssumption("");
  };

  const updateAssumption = (id: string, status: Assumption["status"]) => {
    const updated = assumptions.map((a) => (a.id === id ? { ...a, status } : a));
    onAssumptionsChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assumption Tracker</CardTitle>
        <CardDescription>
          List your assumptions, rank by risk, and track validation status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newAssumption}
            onChange={(e) => setNewAssumption(e.target.value)}
            placeholder="e.g., Traders will adopt a unified portfolio dashboard"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addAssumption()}
          />
          <select
            value={newRisk}
            onChange={(e) => setNewRisk(e.target.value as Assumption["risk"])}
            className="rounded-md border px-3 text-sm"
            title="Risk level"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Button onClick={addAssumption} size="sm">Add</Button>
        </div>

        {assumptions.length > 0 && (
          <div className="space-y-2">
            {[...assumptions]
              .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] - { high: 0, medium: 1, low: 2 }[b.risk]))
              .map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Badge variant="outline" className={`${riskBg[a.risk]} ${riskColor[a.risk]} border-0`}>
                    {a.risk}
                  </Badge>
                  <span className="text-sm flex-1">{a.text}</span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant={a.status === "validated" ? "default" : "ghost"}
                      className="h-7 w-7"
                      onClick={() => updateAssumption(a.id, "validated")}
                      title="Validated"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant={a.status === "invalidated" ? "destructive" : "ghost"}
                      className="h-7 w-7"
                      onClick={() => updateAssumption(a.id, "invalidated")}
                      title="Invalidated"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}

        <Separator />

        <div>
          <p className="text-sm font-medium mb-2">Generate Refine Questions</p>
          <Textarea
            value={context}
            onChange={(e) => onContextChange(e.target.value)}
            placeholder="Describe your current solution direction and key assumptions..."
            rows={3}
          />
          <Button onClick={onGenerate} disabled={generating} className="mt-2">
            {generating ? "Generating..." : "Generate Questions"}
          </Button>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>

        {questions.length > 0 && (
          <div className="space-y-2 mt-4">
            {questions.map((q, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigator.clipboard.writeText(q.text)}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{q.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">Purpose: {q.purpose}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
