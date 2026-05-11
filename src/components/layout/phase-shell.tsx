"use client";

import type { ReactNode } from "react";
import { Search, Compass, Lightbulb, Rocket, type LucideIcon } from "lucide-react";
import type { CorePhase } from "@/types/core";
import { PHASE_CONFIG } from "@/types/core";
import { PageHeader } from "@/components/layout/page-header";
import { PhaseProgress, NextPhaseCTA } from "@/components/layout/phase-progress";
import { PhaseEvidencePanel } from "@/components/layout/phase-evidence-panel";
import { DtMethodsPanel } from "@/components/layout/dt-methods-panel";

const PHASE_ICONS: Record<CorePhase, LucideIcon> = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
};

const PHASE_EYEBROW: Record<CorePhase, string> = {
  capture: "Phase 1 · Capture",
  orchestrate: "Phase 2 · Orchestrate",
  refine: "Phase 3 · Refine",
  execute: "Phase 4 · Execute",
};

const PHASE_GUIDANCE: Record<CorePhase, { heading: string; steps: string[] }> = {
  capture: {
    heading: "Gather raw evidence before forming opinions",
    steps: [
      "Paste transcripts and notes as raw context before interpretation",
      "Attach source material, links, files, recordings, and context fragments",
      "Add evidence manually as you go — it carries forward to Orchestrate",
    ],
  },
  orchestrate: {
    heading: "Turn Capture intake into working understanding",
    steps: [
      "Start with the AI project brief to distill what is known so far",
      "Resolve synthesis questions to expose patterns, unknowns, and decisions needed",
      "Draft the problem frame and use case that should move forward into Refine",
    ],
  },
  refine: {
    heading: "Strengthen the recommendation with expert review",
    steps: [
      "Start from the Orchestrate handoff — problem, use case, evidence, and open questions",
      "Run one advisor or the full expert board to pressure-test the direction",
      "Move surfaced assumptions into validation before preparing Execute outputs",
    ],
  },
  execute: {
    heading: "Package validated work into final artifacts",
    steps: [
      "Generate final reports, decks, summaries, update emails, and handoff packages",
      "Turn the Refine recommendation into stakeholder-ready communication",
      "Track actions, blockers, owners, and follow-up commitments",
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
  const guidance = PHASE_GUIDANCE[phase];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PhaseProgress currentPhase={phase} />

      <PageHeader
        eyebrow={PHASE_EYEBROW[phase]}
        title={config.label}
        description={config.description}
        icon={Icon}
        accent={phase}
      />

      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="mb-1.5 text-sm font-medium">{guidance.heading}</p>
        <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
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
