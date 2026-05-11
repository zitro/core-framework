/** Critic endpoints — signals + compass health. */

import { request } from "@/lib/http";
import type {
  SynthesisCompass,
  SynthesisSignalsResponse,
} from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export const criticApi = {
  signals: (projectId: string) =>
    request<SynthesisSignalsResponse>(`/api/synthesis/${pid(projectId)}/signals`),

  compass: (projectId: string) =>
    request<SynthesisCompass>(`/api/synthesis/${pid(projectId)}/compass`),
};
