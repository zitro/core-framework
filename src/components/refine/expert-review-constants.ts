import {
  Bot,
  ClipboardCheck,
  Cpu,
  GitCompareArrows,
  PanelTop,
  ShieldCheck,
} from "lucide-react";

export const agentIcon: Record<string, typeof Cpu> = {
  solution_architect: Cpu,
  principal_engineer: GitCompareArrows,
  technical_program_manager: ClipboardCheck,
  principal_data_scientist: Bot,
  product_strategist: PanelTop,
  security_compliance_advisor: ShieldCheck,
};

export const gateLabel: Record<string, string> = {
  ready_for_execute: "Ready for Execute",
  needs_validation: "Needs validation",
  pivot: "Pivot direction",
  return_to_orchestrate: "Return to Orchestrate",
};

export const roundtablePhaseLabel: Record<string, string> = {
  initial_position: "1. Initial Position",
  evidence_challenge: "2. Evidence Challenge",
  risk_and_work_items: "3. Risk and Work Items",
  alignment_and_tradeoffs: "4. Alignment and Tradeoffs",
  current_agreement: "5. Current Agreement",
};
