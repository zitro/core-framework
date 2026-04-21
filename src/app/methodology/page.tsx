"use client";

import { Compass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DT_METHODS,
  DT_PRINCIPLES,
  PHASE_TO_DT_STAGE,
  type CorePhase,
} from "@/lib/dt-methods";

const PHASES: CorePhase[] = ["capture", "orient", "refine", "execute"];

export default function MethodologyPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <Compass className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Methodology</h1>
          <p className="text-muted-foreground text-sm">
            How CORE phases map to design thinking, and which methods to reach for.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Principles we hold to</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {DT_PRINCIPLES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {PHASES.map((phase) => {
        const methods = DT_METHODS.filter((m) => m.phase === phase);
        return (
          <Card key={phase}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base capitalize">{phase}</CardTitle>
                <Badge variant="outline">{PHASE_TO_DT_STAGE[phase]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {methods.map((m) => (
                <div key={m.id} className="border-l-2 pl-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{m.name}</h3>
                    {m.template && (
                      <Badge variant="outline" className="text-[10px]">
                        template available
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{m.oneLiner}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">When to use:</span> {m.whenToUse}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
