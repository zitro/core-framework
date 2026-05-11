/** Question endpoints — list + refresh. */

import { request } from "@/lib/http";
import type { SynthesisQuestion } from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export const questionsApi = {
  questions: (projectId: string) =>
    request<{ questions: SynthesisQuestion[] }>(
      `/api/synthesis/${pid(projectId)}/questions`,
    ),

  refreshQuestions: (projectId: string) =>
    request<{ questions: SynthesisQuestion[] }>(
      `/api/synthesis/${pid(projectId)}/questions/refresh`,
      { method: "POST" },
    ),
};
