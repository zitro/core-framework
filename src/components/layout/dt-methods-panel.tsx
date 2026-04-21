"use client";

import Link from "next/link";
import { BookMarked, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  methodsForPhase,
  PHASE_TO_DT_STAGE,
  type CorePhase,
} from "@/lib/dt-methods";

interface DtMethodsPanelProps {
  phase: CorePhase;
}

/**
 * Per-phase nudge: which design-thinking methods to reach for here, and
 * which ones ship as templates the team can drop into their engagement repo.
 */
export function DtMethodsPanel({ phase }: DtMethodsPanelProps) {
  const methods = methodsForPhase(phase);
  if (methods.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-amber-500" />
            Design thinking — {PHASE_TO_DT_STAGE[phase]}
          </CardTitle>
          <Link
            href="/methodology"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
          >
            Methodology
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {methods.map((m) => (
          <div key={m.id} className="border-l-2 pl-3 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold">{m.name}</h4>
              {m.template && (
                <Badge variant="outline" className="text-[9px]">
                  template
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{m.oneLiner}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
