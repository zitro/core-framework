/** Catalog endpoint (registry of artifact types, categories). */

import { request } from "@/lib/http";
import type { SynthesisCatalog } from "@/types/synthesis";

export const catalogApi = {
  catalog: () => request<SynthesisCatalog>("/api/synthesis/catalog"),
};
