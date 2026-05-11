"use client";

import { BookMarked } from "lucide-react";

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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        eyebrow="Tools"
        title="Methodology"
        description="How CORE phases map to design thinking, and which methods to reach for."
        icon={BookMarked}
        accent="brand"
      />

      <section className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Principles we hold to
        </p>
        <ol className="space-y-1">
          {DT_PRINCIPLES.map((p, i) => (
            <li
              key={p}
              className="flex gap-2 border-l-2 border-muted py-0.5 pl-2.5 text-sm leading-relaxed text-foreground/85"
            >
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {i + 1}.
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </section>

      {PHASES.map((phase) => {
        const methods = DT_METHODS.filter((m) => m.phase === phase);
        return (
          <section key={phase} className="space-y-3">
            <header className="flex items-center justify-between gap-2 border-b pb-2">
              <h2 className="font-heading text-base font-semibold tracking-tight capitalize">
                {phase}
              </h2>
              <Badge variant="outline" className="text-[10px]">
                {PHASE_TO_DT_STAGE[phase]}
              </Badge>
            </header>
            <div className="space-y-3">
              {methods.map((m) => (
                <div key={m.id} className="space-y-1 border-l-2 border-muted pl-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{m.name}</h3>
                    {m.template && (
                      <Badge variant="outline" className="text-[10px]">
                        template available
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{m.oneLiner}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium">When to use:</span> {m.whenToUse}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
