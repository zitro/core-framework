export type CorePhase = "capture" | "orchestrate" | "refine" | "execute";

export type FdeStage = "embed" | "prototype" | "ship" | "learn";

export interface DtMethod {
  id: string;
  name: string;
  phase: CorePhase;
  dtStage: "empathize" | "define" | "ideate" | "prototype" | "test";
  oneLiner: string;
  whenToUse: string;
  template?: string;
}

export interface FdeMethod {
  id: string;
  name: string;
  stage: FdeStage;
  oneLiner: string;
  whenToUse: string;
  template?: string;
}

export interface TemplateField {
  id: string;
  label: string;
  placeholder?: string;
  kind?: "text" | "textarea";
}
