"use client";

import { BookMarked } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  DT_METHODS,
  DT_PRINCIPLES,
  PHASE_TO_DT_STAGE,
  type CorePhase,
} from "@/lib/dt-methods";

const PHASES: CorePhase[] = ["capture", "orchestrate", "refine", "execute"];

export default function MethodologyPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Tools"
        title="Methodology"
        description="How CORE phases map to design thinking, and which methods to reach for."
        icon={BookMarked}
        accent="brand"
      />

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
