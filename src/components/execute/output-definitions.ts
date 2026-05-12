import {
  FileText,
  Mail,
  Presentation,
  Send,
  Workflow,
} from "lucide-react";
import type { ExecuteOutputVersion } from "@/types/core";

export type NarrativeAudience = "executive" | "technical" | "customer" | "internal";
export type NarrativeStyle = "narrative" | "brief" | "outline";

export type OutputDefinition = {
  id: string;
  title: string;
  description: string;
  audience: NarrativeAudience;
  style: NarrativeStyle;
  focus: string;
  icon: typeof FileText;
  category: "stakeholder" | "delivery" | "technical";
};

export const OUTPUTS: OutputDefinition[] = [
  {
    id: "executive-brief",
    title: "Executive Decision Brief",
    description: "Decision-ready summary with recommendation, evidence, risks, and asks.",
    audience: "executive",
    style: "brief",
    focus: "Create a final executive decision brief for sponsors. Include the recommendation, why now, evidence, risks, decisions needed, and next steps.",
    icon: FileText,
    category: "stakeholder",
  },
  {
    id: "customer-summary",
    title: "Customer Summary Update",
    description: "Customer-facing recap that confirms what was heard and what happens next.",
    audience: "customer",
    style: "brief",
    focus: "Create a customer-facing discovery summary update. Reflect the customer's language, summarize what we heard, what we recommend, open questions, and next actions.",
    icon: Send,
    category: "stakeholder",
  },
  {
    id: "weekly-update",
    title: "Weekly Update Email",
    description: "Copy-ready weekly update with progress, decisions, blockers, and next week plan.",
    audience: "internal",
    style: "brief",
    focus: "Create a weekly status email. Include progress this week, key decisions, blockers, risks, asks, and next week priorities.",
    icon: Mail,
    category: "delivery",
  },
  {
    id: "deck-outline",
    title: "Stakeholder Deck Outline",
    description: "Slide-by-slide storyline for the final presentation package.",
    audience: "executive",
    style: "outline",
    focus: "Create a stakeholder deck outline. Include slide titles, slide purpose, key message, and the evidence or artifact each slide should reference.",
    icon: Presentation,
    category: "stakeholder",
  },
  {
    id: "technical-handoff",
    title: "Technical Handoff Brief",
    description: "Build-team handoff with architecture, dependencies, risks, and open decisions.",
    audience: "technical",
    style: "outline",
    focus: "Create a technical handoff brief for implementation leads. Include architecture direction, integration points, dependencies, validation gaps, risks, and immediate engineering work items.",
    icon: Workflow,
    category: "technical",
  },
];

export const categoryLabel: Record<OutputDefinition["category"], string> = {
  stakeholder: "Stakeholder outputs",
  delivery: "Delivery operations",
  technical: "Technical handoff",
};

export function latestOutputsById(outputs: ExecuteOutputVersion[]): Record<string, ExecuteOutputVersion> {
  return outputs.reduce<Record<string, ExecuteOutputVersion>>((acc, output) => {
    const current = acc[output.output_id];
    if (!current || output.version >= current.version) {
      acc[output.output_id] = output;
    }
    return acc;
  }, {});
}
