import {
  Cpu,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Question } from "@/types/core";

export const INTRO_CALL_CONTEXT_TEMPLATE = `Meeting type: Intro discovery call
Goal: Introduce teams and understand the customer's current state before solutioning.

Capture:
- Customer goals and desired outcomes
- How work is done today (current process and pain points)
- Existing technologies/platforms and key integrations
- Environment setup path, prerequisites, and internal ownership
- Required approvals/governance and expected lead times
- Initial use case scope, business value, and success measures
- Risks, assumptions, dependencies, and open questions

Please generate practical questions to uncover unknowns and clarify next steps.`;

export const DEFAULT_QUESTION_COUNT = 10;

export type TopicInsert = {
  label: string;
  description: string;
  body: string;
  icon: LucideIcon;
};

export const TOPIC_INSERTS: TopicInsert[] = [
  {
    label: "Stakeholders",
    description: "Owners, sponsors, decision makers, and working team.",
    body: "Stakeholders and ownership:\n- Primary sponsor:\n- Business owner:\n- Technical owner:\n- Decision maker:\n- Working team:",
    icon: Users,
  },
  {
    label: "Current Process",
    description: "Workflow, delays, handoffs, and what works today.",
    body: "How work is done today:\n- Current workflow steps:\n- Pain points / delays:\n- Workarounds in place:\n- What is currently working well:",
    icon: Workflow,
  },
  {
    label: "Technology Landscape",
    description: "Platforms, integrations, data, identity, and constraints.",
    body: "Technology landscape:\n- Core platforms in use:\n- Key integrations/dependencies:\n- Data and identity constraints:\n- Observability/security requirements:",
    icon: Cpu,
  },
  {
    label: "Approvals + Environment",
    description: "Governance, setup path, lead times, and blockers.",
    body: "Approvals and environment setup:\n- Required approvals (security, compliance, architecture, procurement):\n- Environment setup process:\n- Typical lead times:\n- Blockers and escalation path:",
    icon: ShieldCheck,
  },
  {
    label: "Use Case + Value",
    description: "Initial use case, outcomes, metrics, and urgency.",
    body: "Use case and value:\n- Initial use case:\n- Desired outcomes:\n- Success metrics:\n- Timeline pressure / constraints:",
    icon: Target,
  },
];

export const STARTER_INTRO_QUESTIONS: Question[] = [
  {
    text: "What outcomes are most important for this initiative in the next 90 days?",
    purpose: "Anchor discovery to measurable business outcomes.",
    follow_ups: [
      "How are you measuring success today?",
      "What would make this initiative feel successful to leadership?",
    ],
  },
  {
    text: "Can you walk us through how this process works today from start to finish?",
    purpose: "Understand the current-state operating flow.",
    follow_ups: [
      "Where do delays usually happen?",
      "Where do manual handoffs or rework occur?",
    ],
  },
  {
    text: "What are the top pain points your team is dealing with in the current approach?",
    purpose: "Identify friction and prioritize problem severity.",
    follow_ups: [
      "Which pain point has the highest business impact?",
      "Who experiences this pain most often?",
    ],
  },
  {
    text: "Which platforms and systems are critical to this workflow today?",
    purpose: "Map technology landscape and integration dependencies.",
    follow_ups: [
      "Which systems are hardest to integrate with?",
      "Any data quality or latency constraints we should know?",
    ],
  },
  {
    text: "What security, compliance, or architecture approvals are required before work can start?",
    purpose: "Surface governance process and potential delivery gates.",
    follow_ups: [
      "Who are the approvers and what artifacts do they need?",
      "What are typical approval lead times?",
    ],
  },
  {
    text: "How does environment setup happen in your organization today?",
    purpose: "Clarify environment provisioning flow and ownership.",
    follow_ups: [
      "Which team owns provisioning?",
      "What prerequisites tend to block setup?",
    ],
  },
  {
    text: "What is the first use case we should target for fastest business value?",
    purpose: "Prioritize an actionable initial use case.",
    follow_ups: [
      "What is in scope vs out of scope for this first step?",
      "What result would justify moving to phase two?",
    ],
  },
  {
    text: "Who needs to be involved for decisions, execution, and adoption?",
    purpose: "Map stakeholders, authority, and change-readiness.",
    follow_ups: [
      "Who is the executive sponsor?",
      "Who will use the solution day-to-day?",
    ],
  },
  {
    text: "What data, reports, or artifacts would help us understand the current state faster?",
    purpose: "Identify the source material needed to ground synthesis.",
    follow_ups: [
      "Which artifacts are trustworthy and current?",
      "Who owns access to those sources?",
    ],
  },
  {
    text: "What risks or dependencies could prevent progress after this first discovery session?",
    purpose: "Surface blockers that should shape the next working plan.",
    follow_ups: [
      "Which dependency has the longest lead time?",
      "Who can remove or escalate that blocker?",
    ],
  },
];

export type QuestionResolutionBucket = "planning" | "understanding";
export type QuestionResolutionEntry = { question: Question; index: number };

const PLANNING_QUESTION_PATTERN = /\b(plan|planning|next|owner|owns|decision|approve|approval|governance|timeline|milestone|success|scope|use case|business value|sponsor|involved|execution|adoption|environment)\b/i;

export function getQuestionResolutionBucket(question: Question): QuestionResolutionBucket {
  const text = `${question.text} ${question.purpose}`;
  return PLANNING_QUESTION_PATTERN.test(text) ? "planning" : "understanding";
}

export function previewContextBasis(value: string): string {
  const firstMeaningfulLine = value
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .find(Boolean);
  if (!firstMeaningfulLine) return "Current Orchestrate context";
  const label = firstMeaningfulLine.replace(/:$/, "");
  return label.length > 96 ? `${label.slice(0, 96)}...` : label;
}

export function formatEvidenceType(value: string): string {
  return value.replace("_", " ");
}

export function previewText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 260 ? `${normalized.slice(0, 260)}...` : normalized;
}
