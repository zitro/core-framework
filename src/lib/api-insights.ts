/**
 * Cross-cutting insights client (Phase 8).
 *
 * Read-side aggregations over a discovery's data. Each tool gets a
 * thin method here so the /insights frontend page can fetch only what
 * the active tab needs.
 */

import { request } from "@/lib/http";

export type InsightPhase = "capture" | "orchestrate" | "refine" | "execute";

export interface CoverageCell {
  phase: InsightPhase;
  type_id: string;
  label: string;
  count: number;
  status: "missing" | "draft" | "ok";
}

export interface CoverageResponse {
  phases: InsightPhase[];
  cells: CoverageCell[];
  totals: Record<InsightPhase, number>;
}

export const insightsApi = {
  coverage: (discoveryId: string) =>
    request<CoverageResponse>(
      `/api/insights/coverage?discovery_id=${encodeURIComponent(discoveryId)}`,
    ),
};
