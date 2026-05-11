/**
 * v2 endpoints client — storyboard image generation.
 *
 * Lives apart from ``api-synthesis`` because the v2 surface is hosted on
 * its own router (``/api/v2``) and may grow into adjacent v2-only tools.
 */

import { request } from "@/lib/http";
import type { SynthesisArtifact } from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export interface GenerateImagesResult {
  artifact_id: string;
  provider: string;
  generated: number;
  skipped: number;
  artifact: SynthesisArtifact;
}

export const v2Api = {
  generateImages: (projectId: string, artifactId: string) =>
    request<GenerateImagesResult>(
      `/api/v2/${pid(projectId)}/artifacts/${pid(artifactId)}/images`,
      { method: "POST" },
    ),
};
