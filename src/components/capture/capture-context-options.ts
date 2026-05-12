import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  HelpCircle,
  Lightbulb,
  Link as LinkIcon,
  Mic,
  Paperclip,
  Quote,
  ScrollText,
} from "lucide-react";
import type { Evidence } from "@/types/core";

export type CaptureItemType =
  | "note"
  | "observation"
  | "quote"
  | "pain_point"
  | "jtbd"
  | "assumption"
  | "question"
  | "decision"
  | "transcript"
  | "document"
  | "presentation"
  | "recording"
  | "file"
  | "url";

export type ContextOption = {
  value: CaptureItemType;
  label: string;
  description: string;
  placeholder: string;
  source: string;
  evidenceType: Evidence["evidence_type"];
  tags: string[];
  icon: typeof Lightbulb;
  methodIds: string[];
};

export const CONTEXT_OPTIONS: ContextOption[] = [
  {
    value: "note",
    label: "Note",
    description: "General project knowledge, meeting notes, or context fragments.",
    placeholder: "Add project context, stakeholder input, or a useful note...",
    source: "Capture note",
    evidenceType: "observation",
    tags: ["note"],
    icon: Lightbulb,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "observation",
    label: "Observation",
    description: "What was seen or heard before interpretation.",
    placeholder: "Describe what happened, who was involved, and what stood out...",
    source: "Direct observation",
    evidenceType: "observation",
    tags: ["design-thinking", "observation"],
    icon: Eye,
    methodIds: ["observation", "empathy-map"],
  },
  {
    value: "quote",
    label: "Quote",
    description: "Verbatim stakeholder language worth preserving.",
    placeholder: "Paste the quote and add speaker/context if known...",
    source: "Stakeholder quote",
    evidenceType: "quote",
    tags: ["design-thinking", "quote"],
    icon: Quote,
    methodIds: ["stakeholder-interviews", "empathy-map"],
  },
  {
    value: "pain_point",
    label: "Pain Point",
    description: "A friction, delay, risk, or unmet need.",
    placeholder: "Name the friction, who feels it, and the impact...",
    source: "Pain point",
    evidenceType: "pain_point",
    tags: ["design-thinking", "pain-point"],
    icon: AlertTriangle,
    methodIds: ["jtbd", "observation"],
  },
  {
    value: "jtbd",
    label: "JTBD",
    description: "A job, motivation, and desired outcome.",
    placeholder: "When..., I want to..., so I can...",
    source: "Job-to-be-done",
    evidenceType: "jtbd",
    tags: ["design-thinking", "jtbd"],
    icon: CheckCircle2,
    methodIds: ["jtbd", "stakeholder-interviews"],
  },
  {
    value: "assumption",
    label: "Assumption",
    description: "A belief that should be validated later.",
    placeholder: "State the assumption and what would prove or disprove it...",
    source: "Assumption",
    evidenceType: "assumption",
    tags: ["design-thinking", "assumption"],
    icon: HelpCircle,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "question",
    label: "Question",
    description: "An open question the team needs to answer.",
    placeholder: "Capture the question and why it matters...",
    source: "Open question",
    evidenceType: "hypothesis",
    tags: ["question", "follow-up"],
    icon: HelpCircle,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "decision",
    label: "Decision",
    description: "A confirmed choice, constraint, or direction.",
    placeholder: "Record the decision, owner, date, and rationale...",
    source: "Decision",
    evidenceType: "insight",
    tags: ["decision"],
    icon: CheckCircle2,
    methodIds: [],
  },
  {
    value: "transcript",
    label: "Transcript",
    description: "Meeting notes, interview transcripts, calls, or workshops.",
    placeholder: "Paste the full transcript here. Source / speaker goes in the reference field below.",
    source: "Transcript",
    evidenceType: "general",
    tags: ["transcript", "raw-context"],
    icon: ScrollText,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "document",
    label: "Document",
    description: "Docs, PDFs, spreadsheets, exports, or reference files.",
    placeholder: "Add any context that helps interpret the attached document...",
    source: "Document evidence",
    evidenceType: "general",
    tags: ["evidence", "document"],
    icon: FileText,
    methodIds: ["empathy-map"],
  },
  {
    value: "presentation",
    label: "Deck",
    description: "Slides, briefings, and stakeholder presentations.",
    placeholder: "Describe the deck, audience, date, or important sections...",
    source: "Presentation evidence",
    evidenceType: "general",
    tags: ["evidence", "presentation"],
    icon: FileText,
    methodIds: [],
  },
  {
    value: "recording",
    label: "Recording",
    description: "Calls, interviews, workshops, demos, and voice notes.",
    placeholder: "Add meeting context, speakers, or what the recording captures...",
    source: "Recording evidence",
    evidenceType: "general",
    tags: ["evidence", "recording"],
    icon: Mic,
    methodIds: ["stakeholder-interviews"],
  },
  {
    value: "file",
    label: "Other File",
    description: "Any other artifact that should be preserved as context.",
    placeholder: "Describe what this file is and why it matters...",
    source: "File evidence",
    evidenceType: "general",
    tags: ["evidence", "file"],
    icon: Paperclip,
    methodIds: [],
  },
  {
    value: "url",
    label: "URL",
    description: "External links, docs, articles, repos, or dashboards.",
    placeholder: "Add why this link matters and what to look for...",
    source: "Link evidence",
    evidenceType: "general",
    tags: ["evidence", "url"],
    icon: LinkIcon,
    methodIds: [],
  },
];
