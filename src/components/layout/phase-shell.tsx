"use client";

import type { ReactNode } from "react";
import { Search, Compass, Lightbulb, Rocket, type LucideIcon } from "lucide-react";
import type { CorePhase } from "@/types/core";
import { PHASE_CONFIG } from "@/types/core";
import { PhaseProgress, NextPhaseCTA } from "@/components/layout/phase-progress";
import { PhaseEvidencePanel } from "@/components/layout/phase-evidence-panel";
import { DtMethodsPanel } from "@/components/layout/dt-methods-panel";

const PHASE_ICONS: Record<CorePhase, LucideIcon> = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
};

const PHASE_ICON_BG: Record<CorePhase, string> = {
  capture: "bg-blue-500/10 text-blue-500",
  orchestrate: "bg-amber-500/10 text-amber-500",
  refine: "bg-emerald-500/10 text-emerald-500",
  execute: "bg-violet-500/10 text-violet-500",
};

const PHASE_GUIDANCE: Record<CorePhase, { heading: string; steps: string[] }> = {
  capture: {
    heading: "Gather raw evidence before forming opinions",
    steps: [
      "Paste a meeting transcript — AI extracts evidence, themes, and insights",
      "Generate discovery questions tailored to your engagement context",
      "Add evidence manually as you go — it carries forward to Orchestrate",
    ],
  },
  orchestrate: {
    heading: "Synthesize evidence and frame the real problem",
    steps: [
      "Review synthesis questions to expose patterns and unknowns from Capture",
      "Draft a shared problem frame with constraints, approvals, and environment realities",
      "Convert synthesis into a clear problem statement and actionable use case",
    ],
  },
  refine: {
    heading: "Test assumptions and match solutions to evidence",
    steps: [
      "List your assumptions — rate risk and track validation status",
      "Run the Solution Matcher: AI maps your problem to known capabilities",
      "Generate refine questions to guide assumption testing sessions",
    ],
  },
  execute: {
    heading: "Deliver a quick win and prepare the handoff",
    steps: [
      "Define quick wins — small, high-impact deliverables",
      "Track blockers and their resolutions",
      "Write handoff notes for the implementation team",
    ],
  },
};

interface PhaseShellProps {
  phase: CorePhase;
  discoveryId: string;
  children: ReactNode;
  showEvidencePanel?: boolean;
  showDtMethodsPanel?: boolean;
}

export function PhaseShell({
  phase,
  discoveryId,
  children,
  showEvidencePanel = true,
  showDtMethodsPanel = true,
}: PhaseShellProps) {
  const config = PHASE_CONFIG[phase];
  const Icon = PHASE_ICONS[phase];
  const iconStyle = PHASE_ICON_BG[phase];
  const guidance = PHASE_GUIDANCE[phase];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Progress Stepper */}
      <PhaseProgress currentPhase={phase} />

      {/* Phase Header */}
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconStyle}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{config.label}</h1>
          <p className="text-muted-foreground text-sm">{config.description}</p>
        </div>
      </div>

      {/* Guidance */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium mb-1.5">{guidance.heading}</p>
        <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
          {guidance.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Main Content */}
      {children}

      {/* Phase Evidence Panel */}
      {showEvidencePanel && (
        <PhaseEvidencePanel discoveryId={discoveryId} phase={phase} collapsible={phase !== "capture"} />
      )}

      {/* Design thinking methods for this phase */}
      {showDtMethodsPanel && <DtMethodsPanel phase={phase} discoveryId={discoveryId} />}

      {/* Next Phase CTA */}
      <NextPhaseCTA currentPhase={phase} />
    </div>
  );
}
