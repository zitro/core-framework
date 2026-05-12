import type { ContextBriefVersion } from "@/types/core";

export const REVIEW_PROMPTS: { label: string; body: string }[] = [
  {
    label: "Missing stakeholder",
    body: "Add or correct stakeholder context:\n- Role/team:\n- Why they matter:\n- Decision or input needed:",
  },
  {
    label: "Wrong priority",
    body: "Correct the project priority:\n- What the brief overstates or misses:\n- What matters most now:\n- Why:",
  },
  {
    label: "Add constraint",
    body: "Add delivery constraint:\n- Constraint:\n- Owner/team affected:\n- Impact on timeline or scope:",
  },
  {
    label: "Add open question",
    body: "Add open question:\n- Question:\n- Why it matters:\n- Who can answer it:",
  },
];

export function formatBriefAsContext(version: ContextBriefVersion): string {
  const lines = [
    `AI project brief v${version.version}: ${version.title || "Project Brief"}`,
    version.summary,
    "",
    "Goals:",
    ...version.goals.map((item) => `- ${item}`),
    "",
    "Stakeholders:",
    ...version.stakeholders.map((item) => `- ${item}`),
    "",
    "Constraints and risks:",
    ...[...version.constraints, ...version.risks].map((item) => `- ${item}`),
    "",
    "Open questions:",
    ...version.open_questions.map((item) => `- ${item}`),
  ];
  return lines
    .filter((line, index) => line.trim() || lines[index - 1]?.trim())
    .join("\n")
    .trim();
}
