export type CorePhase = "capture" | "orchestrate" | "refine" | "execute";
export type DiscoveryMode = "standard" | "fde" | "workshop_sprint";
export type ConfidenceLevel = "validated" | "assumed" | "unknown" | "conflicting";

export const PHASE_CONFIG: Record<
  CorePhase,
  { label: string; description: string; icon: string; color: string }
> = {
  capture: {
    label: "Capture",
    description: "Probe the system, gather evidence, map stakeholders",
    icon: "Search",
    color: "blue",
  },
  orchestrate: {
    label: "Orchestrate",
    description: "Synthesize evidence, frame the real problem, and align direction",
    icon: "Compass",
    color: "amber",
  },
  refine: {
    label: "Refine",
    description: "Expert review, validation, and recommendation shaping",
    icon: "Lightbulb",
    color: "emerald",
  },
  execute: {
    label: "Execute",
    description: "Generate final artifacts, updates, and handoff packages",
    icon: "Rocket",
    color: "violet",
  },
};

export const MODE_CONFIG: Record<
  DiscoveryMode,
  { label: string; description: string; duration: string }
> = {
  standard: {
    label: "Standard Discovery",
    description: "Full CORE cycle for deep product discovery",
    duration: "2-6 weeks",
  },
  fde: {
    label: "Forward Deployed Engineering",
    description: "Embedded discovery with hands-on delivery",
    duration: "4-12 weeks",
  },
  workshop_sprint: {
    label: "Workshop Sprint",
    description: "Rapid 2-3 day engagement: one quick win + blocker map",
    duration: "2-3 days",
  },
};
