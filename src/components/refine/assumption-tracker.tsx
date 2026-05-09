"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Assumption } from "@/types/core";

const riskColor = { high: "text-red-500", medium: "text-amber-500", low: "text-emerald-500" };
const riskBg = { high: "bg-red-500/10", medium: "bg-amber-500/10", low: "bg-emerald-500/10" };
type CertaintyLevel = NonNullable<Assumption["certainty"]>;

interface AssumptionTrackerProps {
  assumptions: Assumption[];
  onAssumptionsChange: (assumptions: Assumption[]) => void;
}

export function AssumptionTracker({
  assumptions,
  onAssumptionsChange,
}: AssumptionTrackerProps) {
  const [newAssumption, setNewAssumption] = useState("");
  const [newRisk, setNewRisk] = useState<"high" | "medium" | "low">("medium");
  const [newCertainty, setNewCertainty] = useState<CertaintyLevel>("unknown");

  const addAssumption = () => {
    if (!newAssumption.trim()) return;
    const updated = [
      ...assumptions,
      {
        id: crypto.randomUUID(),
        text: newAssumption,
        risk: newRisk,
        status: "untested" as const,
        certainty: newCertainty,
        evidence: "",
        validation_method: "",
        owner: "",
        impact_if_wrong: "",
      },
    ];
    onAssumptionsChange(updated);
    setNewAssumption("");
  };

  const updateAssumption = (id: string, patch: Partial<Assumption>) => {
    const updated = assumptions.map((a) => (a.id === id ? { ...a, ...patch } : a));
    onAssumptionsChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-emerald-500" />
          Assumption Validation Tracker
        </CardTitle>
        <CardDescription>
          Track what the expert panel says must be proven before Execute turns the recommendation into final artifacts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[1fr_120px_140px_auto]">
          <Input
            value={newAssumption}
            onChange={(e) => setNewAssumption(e.target.value)}
            placeholder="e.g., Users will trust an AI-generated recommendation if the evidence trail is visible"
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
          <select
            value={newCertainty}
            onChange={(e) => setNewCertainty(e.target.value as CertaintyLevel)}
            className="rounded-md border px-3 text-sm"
            title="Certainty level"
          >
            <option value="unknown">Unknown certainty</option>
            <option value="low">Low certainty</option>
            <option value="medium">Medium certainty</option>
            <option value="high">High certainty</option>
          </select>
          <Button onClick={addAssumption} size="sm">Add</Button>
        </div>

        {assumptions.length > 0 && (
          <div className="space-y-2">
            {[...assumptions]
              .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] - { high: 0, medium: 1, low: 2 }[b.risk]))
              .map((a) => (
                <div key={a.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className={`${riskBg[a.risk]} ${riskColor[a.risk]} border-0 shrink-0`}>
                      {a.risk} risk
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.text}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>
                        <Badge variant="outline" className="text-[10px]">{a.certainty || "unknown"} certainty</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant={a.status === "validated" ? "default" : "ghost"}
                        className="h-7 w-7"
                        onClick={() => updateAssumption(a.id, { status: "validated" })}
                        title="Validated"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant={a.status === "invalidated" ? "destructive" : "ghost"}
                        className="h-7 w-7"
                        onClick={() => updateAssumption(a.id, { status: "invalidated" })}
                        title="Invalidated"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <InlineField label="Evidence" value={a.evidence || ""} onChange={(value) => updateAssumption(a.id, { evidence: value })} />
                    <InlineField label="Validation method" value={a.validation_method || ""} onChange={(value) => updateAssumption(a.id, { validation_method: value })} />
                    <InlineField label="Owner" value={a.owner || ""} onChange={(value) => updateAssumption(a.id, { owner: value })} />
                    <InlineField label="Impact if wrong" value={a.impact_if_wrong || ""} onChange={(value) => updateAssumption(a.id, { impact_if_wrong: value })} />
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InlineField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} />
    </div>
  );
}
