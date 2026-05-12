import { request } from "@/lib/http";

export const narrative = {
  generate: (data: {
    discovery_id: string;
    audience?: "executive" | "technical" | "customer" | "internal";
    style?: "narrative" | "brief" | "outline";
    focus?: string;
  }) =>
    request<{
      discovery_id: string;
      audience: string;
      style: string;
      headline: string;
      summary: string;
      sections: Array<{ title: string; body: string }>;
    }>("/api/narrative/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
