import type { FdeMethod, FdeStage } from "./types";

export const FDE_METHODS: FdeMethod[] = [
  {
    id: "customer-shadowing",
    name: "Customer Shadowing",
    stage: "embed",
    oneLiner: "Spend a day in the seat the user occupies; observe, don't interview.",
    whenToUse: "Week one. Before you draft anything, sit beside the work.",
  },
  {
    id: "champion-map",
    name: "Champion Map",
    stage: "embed",
    oneLiner: "Identify who must say 'yes' and what would make them say it.",
    whenToUse: "Whenever a stakeholder feels missing or a decision keeps stalling.",
    template: "champion-map",
  },
  {
    id: "pair-on-real-task",
    name: "Pair on the Real Task",
    stage: "embed",
    oneLiner: "Sit beside an SME for an hour and watch where they actually get stuck.",
    whenToUse: "When recorded interviews feel rehearsed or generic.",
  },
  {
    id: "lightning-prototype",
    name: "Lightning Prototype",
    stage: "prototype",
    oneLiner: "A click-through or hardcoded happy path in 1-3 days; tests the framing, not the build.",
    whenToUse: "Once a HMW is sharp enough to put pixels (or fake data) behind.",
  },
  {
    id: "working-slice",
    name: "Working Slice",
    stage: "ship",
    oneLiner: "The thinnest end-to-end path through the real system — production-real, not demo-real.",
    whenToUse: "When the prototype clears its bar; move from belief to evidence.",
  },
  {
    id: "production-first-deploy",
    name: "Production-First Deploy",
    stage: "ship",
    oneLiner: "From the first commit, the artifact lives in the customer's environment.",
    whenToUse: "Always. Staging-only work decays; production-only work is honest.",
  },
  {
    id: "daily-demo",
    name: "Daily Demo",
    stage: "ship",
    oneLiner: "A 10-minute Loom or screen-share each working day — keeps direction honest.",
    whenToUse: "Every working day a slice is in motion.",
  },
  {
    id: "ship-and-learn-loop",
    name: "Ship-and-Learn Loop",
    stage: "learn",
    oneLiner: "Define the next decision to test, ship the artifact that tests it, capture the learning, repeat.",
    whenToUse: "After every working slice lands; before scoping the next.",
  },
];

export const FDE_STAGE_LABEL: Record<FdeStage, string> = {
  embed: "Embed",
  prototype: "Prototype",
  ship: "Ship",
  learn: "Learn",
};

export const FDE_PRINCIPLES = [
  "Sit with the customer; build for them, not at them.",
  "Show working software within the first week.",
  "Production from day one — no demo dust.",
  "Solve the real problem, not the one in the brief.",
  "Ship the next decision, not the whole roadmap.",
];

export function fdeMethodsByStage(stage: FdeStage): FdeMethod[] {
  return FDE_METHODS.filter((m) => m.stage === stage);
}
