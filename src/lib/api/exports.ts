import { API_URL } from "@/lib/http";

export const exportApi = {
  download: (discoveryId: string, format: "json" | "csv" = "json") => {
    const url = `${API_URL}/api/export/${discoveryId}?format=${format}`;
    window.open(url, "_blank");
  },
};
