import { request } from "@/lib/http";

export const docs = {
  scan: (path: string) =>
    request<{
      path: string;
      files: { name: string; size: number; extension: string }[];
      total_size: number;
    }>("/api/docs/scan", { method: "POST", body: JSON.stringify({ path }) }),
};
