/** Artifact endpoints — list, synthesize, regenerate. */

import { request } from "@/lib/http";
import type {
  SynthesisArtifact,
  SynthesisCritique,
  SynthesisRunResult,
} from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export const artifactsApi = {
  artifacts: (projectId: string) =>
    request<{ artifacts: SynthesisArtifact[] }>(
      `/api/synthesis/${pid(projectId)}/artifacts`,
    ),

  synthesize: (
    projectId: string,
    opts: { missingOnly?: boolean; includeNonCritical?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.missingOnly) params.set("missing_only", "true");
    if (opts.includeNonCritical) params.set("include_non_critical", "true");
    const qs = params.toString();
    return request<SynthesisRunResult>(
      `/api/synthesis/${pid(projectId)}/synthesize${qs ? `?${qs}` : ""}`,
      { method: "POST" },
    );
  },

  regenerate: (projectId: string, typeId: string, instructions = "") =>
    request<{ artifact: SynthesisArtifact; critique: SynthesisCritique | null }>(
      `/api/synthesis/${pid(projectId)}/artifacts/${pid(typeId)}/regenerate`,
      {
        method: "POST",
        body: JSON.stringify({ type_id: typeId, instructions }),
      },
    ),
};
