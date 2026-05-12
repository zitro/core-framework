import { request } from "@/lib/http";

export const health = () =>
  request<{ status: string; providers: Record<string, string> }>("/api/health");

export const me = () =>
  request<{
    auth_provider: string;
    authenticated: boolean;
    sub: string;
    name: string;
    email: string;
    tenant_id: string;
  }>("/api/me");

export const githubAuth = {
  status: () => request<{ connected: boolean; login: string }>("/api/github/oauth/status"),
  disconnect: () =>
    request<{ disconnected: boolean }>("/api/github/oauth/disconnect", {
      method: "POST",
    }),
};

export const search = (query: string, limit = 5) =>
  request<{
    query: string;
    enabled: boolean;
    results: Array<{ title: string; url: string; snippet: string; source: string }>;
  }>("/api/search", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  });
