/** Note ingestion — user appends a note that's folded into artifacts. */

import { request } from "@/lib/http";
import type { SynthesisArtifact } from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export const notesApi = {
  addNote: (
    projectId: string,
    payload: { text: string; target_type_id?: string; propagate?: boolean },
  ) =>
    request<{
      note_id: string;
      regenerated: SynthesisArtifact[];
      failures: string[];
    }>(`/api/synthesis/${pid(projectId)}/notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
