import type { CorePhase, QuestionSet, SolutionMatchResult } from "@/types/core";
import { request } from "@/lib/http";
import { toBackendPhase } from "@/lib/api/_helpers";

export const questions = {
  list: (discoveryId: string, phase?: CorePhase) =>
    request<QuestionSet[]>(
      `/api/questions/${discoveryId}${phase ? `?phase=${toBackendPhase(phase)}` : ""}`
    ),
  generate: (data: {
    discovery_id: string;
    phase: CorePhase;
    context?: string;
    num_questions?: number;
  }) =>
    request<QuestionSet>("/api/questions/generate", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        phase: toBackendPhase(data.phase),
      }),
    }),
  solutionMatch: (data: {
    discovery_id: string;
    problem: string;
    capabilities: string[];
  }) =>
    request<SolutionMatchResult>("/api/questions/solution-match", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
