/** Connector registry + per-project config endpoints. */

import { request } from "@/lib/http";
import type { SynthesisConnector } from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export const connectorsApi = {
  connectors: () =>
    request<{ connectors: SynthesisConnector[] }>("/api/synthesis/connectors"),

  updateConnectorConfig: (
    projectId: string,
    kind: string,
    config: Record<string, unknown>,
  ) =>
    request<{ sources: Record<string, unknown> }>(
      `/api/synthesis/${pid(projectId)}/connectors`,
      {
        method: "PUT",
        body: JSON.stringify({ kind, config }),
      },
    ),
};
