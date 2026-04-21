/**
 * Shared design thinking methods catalog.
 *
 * Used by the methodology page and the per-phase guidance panel.
 * Keep entries short; the goal is to nudge teams toward the right method
 * at the right time, not to teach the method in full.
 */

export type CorePhase = "capture" | "orient" | "refine" | "execute";

export interface DtMethod {
  id: string;
  name: string;
  phase: CorePhase;
  dtStage: "empathize" | "define" | "ideate" | "prototype" | "test";
  oneLiner: string;
  whenToUse: string;
  template?: string;
}

export const DT_METHODS: DtMethod[] = [
  // Capture / Empathize
  {
    id: "stakeholder-interviews",
    name: "Stakeholder Interviews",
    phase: "capture",
    dtStage: "empathize",
    oneLiner: "Open, non-leading questions that surface lived experience.",
    whenToUse: "First contact. Before you have opinions worth defending.",
  },
  {
    id: "empathy-map",
    name: "Empathy Map",
    phase: "capture",
    dtStage: "empathize",
    oneLiner: "What users say, think, do, and feel.",
    whenToUse: "After 3-5 interviews, to consolidate raw quotes into a single view.",
    template: "empathy-map",
  },
  {
    id: "jtbd",
    name: "Jobs-to-be-Done",
    phase: "capture",
    dtStage: "empathize",
    oneLiner: "When [situation], I want to [motivation], so I can [outcome].",
    whenToUse: "When motivations are unclear or stakeholders disagree on goals.",
  },
  {
    id: "observation",
    name: "Direct Observation",
    phase: "capture",
    dtStage: "empathize",
    oneLiner: "Watch the work as it actually happens, not as it is described.",
    whenToUse: "When the gap between reported and actual workflow is suspected.",
  },

  // Orient / Define
  {
    id: "affinity-clustering",
    name: "Affinity Clustering",
    phase: "orient",
    dtStage: "define",
    oneLiner: "Group raw evidence into themes to see patterns.",
    whenToUse: "Once you have 20+ pieces of evidence and need to find structure.",
  },
  {
    id: "five-whys",
    name: "5 Whys",
    phase: "orient",
    dtStage: "define",
    oneLiner: "Push past symptom to root cause by asking 'why' five times.",
    whenToUse: "When the visible problem feels suspiciously surface-level.",
  },
  {
    id: "hmw",
    name: "How Might We",
    phase: "orient",
    dtStage: "define",
    oneLiner: "Reframe a pain point as a solvable, optimistic invitation.",
    whenToUse: "Bridging from problem framing to ideation.",
    template: "hmw-board",
  },
  {
    id: "persona",
    name: "Persona",
    phase: "orient",
    dtStage: "define",
    oneLiner: "A grounded, evidence-based archetype of a key user group.",
    whenToUse: "When the team keeps saying 'the user' without agreeing who that is.",
    template: "persona",
  },
  {
    id: "journey-map",
    name: "Journey Map",
    phase: "orient",
    dtStage: "define",
    oneLiner: "End-to-end view of the user's experience across touchpoints.",
    whenToUse: "When pain points feel scattered and you need to see the system.",
    template: "journey-map",
  },

  // Refine / Ideate + Prototype
  {
    id: "divergent-ideation",
    name: "Divergent Ideation",
    phase: "refine",
    dtStage: "ideate",
    oneLiner: "Generate as many options as possible before judging any.",
    whenToUse: "After framing a HMW. Quantity first; quality emerges from quantity.",
  },
  {
    id: "crazy-8s",
    name: "Crazy 8s",
    phase: "refine",
    dtStage: "ideate",
    oneLiner: "Eight rough ideas in eight minutes — break out of the obvious answer.",
    whenToUse: "When the team converges too early on the first 'good enough' idea.",
  },
  {
    id: "assumption-mapping",
    name: "Assumption Mapping",
    phase: "refine",
    dtStage: "prototype",
    oneLiner: "List assumptions, plot by risk and certainty, test the riskiest.",
    whenToUse: "Before committing build effort to any chosen direction.",
    template: "assumption-matrix",
  },
  {
    id: "storyboard",
    name: "Storyboard",
    phase: "refine",
    dtStage: "prototype",
    oneLiner: "A short visual narrative of how the solution plays out.",
    whenToUse: "Communicating an idea to a non-technical audience cheaply.",
  },

  // Execute / Test
  {
    id: "quick-win",
    name: "Quick Win",
    phase: "execute",
    dtStage: "test",
    oneLiner: "Smallest scoped delivery that proves value in weeks, not months.",
    whenToUse: "Always. If you cannot define a quick win, you have not framed the problem.",
  },
  {
    id: "success-metrics",
    name: "Success Metrics",
    phase: "execute",
    dtStage: "test",
    oneLiner: "Define how you will know it worked, before you start.",
    whenToUse: "At kickoff of any quick win. Re-validated at each checkpoint.",
  },
  {
    id: "retro",
    name: "Retro",
    phase: "execute",
    dtStage: "test",
    oneLiner: "Short, candid review: what worked, what did not, what to change.",
    whenToUse: "End of every sprint and every quick win.",
  },
];

export const PHASE_TO_DT_STAGE: Record<CorePhase, string> = {
  capture: "Empathize",
  orient: "Define",
  refine: "Ideate / Prototype",
  execute: "Test / Deliver",
};

export const DT_PRINCIPLES = [
  "Problem before solution.",
  "Evidence beats opinion.",
  "Assumptions are first-class.",
  "Diverge then converge.",
  "Smallest valuable thing.",
];

export function methodsForPhase(phase: CorePhase): DtMethod[] {
  return DT_METHODS.filter((m) => m.phase === phase);
}
