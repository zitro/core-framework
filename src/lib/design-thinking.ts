/**
 * Design Thinking phase mapping for the /refine artifact catalog.
 *
 * The catalog is canonically grouped by stage (`why`, `what`, `how`, ...).
 * This module gives an alternate lens that regroups the same catalog
 * types under the six classical DT phases. No artifacts are duplicated:
 * each catalog type belongs to exactly one phase. Anything not mapped
 * falls back into a final "Other" bucket so the view stays exhaustive.
 */

import type { SynthesisCatalog } from "@/lib/api-synthesis";

export type DTPhaseId =
  | "empathize"
  | "define"
  | "ideate"
  | "prototype"
  | "test"
  | "deliver";

export interface DTPhase {
  id: DTPhaseId;
  label: string;
  description: string;
}

export const DT_PHASES: readonly DTPhase[] = [
  {
    id: "empathize",
    label: "Empathize",
    description: "Understand the customer, their context, and their pain.",
  },
  {
    id: "define",
    label: "Define",
    description: "Synthesize the problem, drivers, and what success means.",
  },
  {
    id: "ideate",
    label: "Ideate",
    description: "Generate possible solutions and frame the bets.",
  },
  {
    id: "prototype",
    label: "Prototype",
    description: "Make the solution concrete enough to react to.",
  },
  {
    id: "test",
    label: "Test",
    description: "Validate assumptions, surface risks, capture open questions.",
  },
  {
    id: "deliver",
    label: "Deliver",
    description: "Communicate, plan, and ship — internal and customer-facing.",
  },
];

const TYPE_TO_PHASE: Record<string, DTPhaseId> = {
  // Empathize
  "customer-pain": "empathize",
  persona: "empathize",
  "empathy-map": "empathize",
  "journey-map": "empathize",
  "interview-guide": "empathize",
  jtbd: "empathize",
  // Define
  "problem-statement": "define",
  "business-driver": "define",
  "root-cause": "define",
  "emerging-themes": "define",
  "value-hypothesis": "define",
  "strategic-alignment": "define",
  "success-criteria": "define",
  kpi: "define",
  "roi-narrative": "define",
  // Ideate
  hmw: "ideate",
  "solution-sketch": "ideate",
  capability: "ideate",
  feature: "ideate",
  "quick-win": "ideate",
  "workshop-plan": "ideate",
  // Prototype
  "tech-option": "prototype",
  "architecture-sketch": "prototype",
  "data-flow": "prototype",
  workstream: "prototype",
  storyboard: "prototype",
  // Test
  "open-questions": "test",
  "assumption-matrix": "test",
  "risk-register": "test",
  // Deliver
  "executive-brief": "deliver",
  "elevator-pitch": "deliver",
  "deck-outline": "deliver",
  "customer-readout": "deliver",
  "press-release": "deliver",
  "phase-plan": "deliver",
  "in-out-of-scope": "deliver",
  timeline: "deliver",
  "resource-plan": "deliver",
  "status-update": "deliver",
  "weekly-email-update": "deliver",
  "wrap-up": "deliver",
  retro: "deliver",
};

export function phaseForTypeId(typeId: string): DTPhaseId | null {
  return TYPE_TO_PHASE[typeId] ?? null;
}

export interface DTGroupedType {
  id: string;
  label: string;
  description?: string;
  /** The original catalog category id, kept so cards can render their badge. */
  categoryId: string;
}

export interface DTGroupedPhase extends DTPhase {
  types: DTGroupedType[];
}

/**
 * Regroup a stage-oriented catalog into Design Thinking phases.
 * Phases with zero mapped types are dropped. An "Other" phase is appended
 * if any catalog type is missing from {@link TYPE_TO_PHASE}.
 */
export function groupCatalogByDTPhase(
  catalog: SynthesisCatalog,
): DTGroupedPhase[] {
  const buckets: Record<DTPhaseId, DTGroupedType[]> = {
    empathize: [],
    define: [],
    ideate: [],
    prototype: [],
    test: [],
    deliver: [],
  };
  const orphans: DTGroupedType[] = [];

  for (const cat of catalog.categories) {
    for (const t of cat.types) {
      const grouped: DTGroupedType = {
        id: t.id,
        label: t.label,
        description: t.description ?? undefined,
        categoryId: cat.id,
      };
      const phase = TYPE_TO_PHASE[t.id];
      if (phase) {
        buckets[phase].push(grouped);
      } else {
        orphans.push(grouped);
      }
    }
  }

  const out: DTGroupedPhase[] = DT_PHASES.filter(
    (p) => buckets[p.id].length > 0,
  ).map((p) => ({ ...p, types: buckets[p.id] }));

  if (orphans.length > 0) {
    out.push({
      id: "deliver", // typed fallback; UI uses label not id for orphans
      label: "Other",
      description: "Catalog types not yet mapped to a Design Thinking phase.",
      types: orphans,
    });
  }

  return out;
}
