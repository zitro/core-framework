import type { TemplateField } from "./types";

export const TEMPLATE_FIELDS: Record<string, TemplateField[]> = {
  "empathy-map": [
    { id: "says", label: "Says", placeholder: "Direct quotes from interviews or observations.", kind: "textarea" },
    { id: "thinks", label: "Thinks", placeholder: "What they think but may not say aloud — beliefs, worries, motivations.", kind: "textarea" },
    { id: "does", label: "Does", placeholder: "Observable actions, behaviors, tools used, workarounds.", kind: "textarea" },
    { id: "feels", label: "Feels", placeholder: "Emotions: frustration, hope, resignation, pride.", kind: "textarea" },
  ],
  "hmw-board": [
    { id: "pain", label: "Pain or observation", placeholder: "What's actually wrong — the raw observation.", kind: "textarea" },
    { id: "reframe", label: "Reframe", placeholder: "Turn the pain into a neutral problem statement.", kind: "textarea" },
    { id: "hmw", label: "How might we…", placeholder: "How might we [verb] [user] so they can [outcome]?", kind: "textarea" },
  ],
  "persona": [
    { id: "name", label: "Name & role", placeholder: "e.g. 'Priya, ops manager at a mid-size logistics firm'", kind: "text" },
    { id: "goals", label: "Goals", placeholder: "What they're trying to accomplish in their week.", kind: "textarea" },
    { id: "frustrations", label: "Frustrations", placeholder: "What's blocking them today.", kind: "textarea" },
    { id: "a-day-in-the-life", label: "A day in their life", placeholder: "How a typical day flows, where the work bunches up.", kind: "textarea" },
    { id: "tools", label: "Tools they live in", placeholder: "Systems, spreadsheets, comms channels.", kind: "textarea" },
  ],
  "journey-map": [
    { id: "stages", label: "Stages", placeholder: "List the stages of the journey, one per line.", kind: "textarea" },
    { id: "actions", label: "What they do at each stage", placeholder: "Actions / decisions / handoffs per stage.", kind: "textarea" },
    { id: "pain-points", label: "Pain points", placeholder: "Where it breaks down, slows, or frustrates.", kind: "textarea" },
    { id: "opportunities", label: "Opportunities", placeholder: "Where CORE could change the shape of the journey.", kind: "textarea" },
  ],
  "assumption-matrix": [
    { id: "high-risk-high-certainty", label: "High risk · High certainty", placeholder: "Assumptions we're confident about but that matter if wrong.", kind: "textarea" },
    { id: "high-risk-low-certainty", label: "High risk · Low certainty (test first)", placeholder: "The riskiest, least-evidenced assumptions — test these next.", kind: "textarea" },
    { id: "low-risk-high-certainty", label: "Low risk · High certainty", placeholder: "Safe to proceed without further testing.", kind: "textarea" },
    { id: "low-risk-low-certainty", label: "Low risk · Low certainty", placeholder: "Worth watching, not worth testing yet.", kind: "textarea" },
  ],
  "champion-map": [
    { id: "champion", label: "Who is the champion?", placeholder: "Name, role, why they care.", kind: "textarea" },
    { id: "their-goal", label: "What outcome do they need?", placeholder: "What success looks like from their seat.", kind: "textarea" },
    { id: "what-blocks-them", label: "What's blocking them?", placeholder: "Organizational, technical, political constraints.", kind: "textarea" },
    { id: "what-we-offer", label: "What we offer them", placeholder: "The smallest move that makes them visibly successful.", kind: "textarea" },
    { id: "blockers-to-yes", label: "Who else must say yes?", placeholder: "Other stakeholders and what each needs to hear.", kind: "textarea" },
  ],
};

export const AUTOGEN_TEMPLATES = new Set<string>([
  "empathy-map",
  "persona",
  "journey-map",
  "hmw-board",
  "champion-map",
]);

export function supportsAutogen(templateId: string | undefined): boolean {
  return Boolean(templateId && AUTOGEN_TEMPLATES.has(templateId));
}

export function getTemplateFields(templateId: string): TemplateField[] {
  return TEMPLATE_FIELDS[templateId] ?? [];
}
