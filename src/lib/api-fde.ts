import type {
  Engagement,
  EngagementStatus,
  Review,
  ReviewStatus,
  CompanyProfileRecord,
} from "@/types/fde";
import { authHeader, API_URL, request } from "@/lib/http";
import { toast } from "sonner";

export const engagementsApi = {
  list: () => request<Engagement[]>("/api/engagements/"),
  get: (id: string) => request<Engagement>(`/api/engagements/${id}`),
  getBySlug: (slug: string) => request<Engagement>(`/api/engagements/by-slug/${slug}`),
  create: (data: Partial<Engagement>) =>
    request<Engagement>("/api/engagements/", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        slug: data.slug ?? "",
        customer: data.customer ?? "",
        industry: data.industry ?? "",
        summary: data.summary ?? "",
        status: data.status ?? "proposed",
        repo_path: data.repo_path ?? "",
        discovery_ids: data.discovery_ids ?? [],
        owners: data.owners ?? [],
        tags: data.tags ?? [],
      }),
    }),
  update: (
    id: string,
    data: Partial<
      Pick<
        Engagement,
        | "name"
        | "customer"
        | "industry"
        | "summary"
        | "status"
        | "repo_path"
        | "discovery_ids"
        | "owners"
        | "tags"
      >
    > & { status?: EngagementStatus },
  ) =>
    request<Engagement>(`/api/engagements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/engagements/${id}`, {
      method: "DELETE",
    }),
  attachDiscovery: (id: string, discoveryId: string) =>
    request<Engagement>(
      `/api/engagements/${id}/discoveries/${discoveryId}`,
      { method: "POST" },
    ),
  detachDiscovery: (id: string, discoveryId: string) =>
    request<Engagement>(
      `/api/engagements/${id}/discoveries/${discoveryId}`,
      { method: "DELETE" },
    ),
};

/** ``Project`` is the canonical name for an engagement; this alias matches v1.1+ vocabulary. */
export const projectsApi = engagementsApi;

export const reviewsApi = {
  list: (params?: { discovery_id?: string; status?: ReviewStatus }) => {
    const qs = new URLSearchParams();
    if (params?.discovery_id) qs.set("discovery_id", params.discovery_id);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<Review[]>(`/api/reviews/${q ? `?${q}` : ""}`);
  },
  request: (data: {
    discovery_id?: string;
    artifact_collection: string;
    artifact_id: string;
    artifact_title?: string;
    comment?: string;
  }) =>
    request<Review>("/api/reviews/", {
      method: "POST",
      body: JSON.stringify({
        discovery_id: data.discovery_id ?? "",
        artifact_collection: data.artifact_collection,
        artifact_id: data.artifact_id,
        artifact_title: data.artifact_title ?? "",
        comment: data.comment ?? "",
        status: "pending",
        requested_by: "",
        reviewer: "",
      }),
    }),
  decide: (
    id: string,
    data: { status: ReviewStatus; reviewer?: string; comment?: string },
  ) =>
    request<Review>(`/api/reviews/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({
        status: data.status,
        reviewer: data.reviewer ?? "",
        comment: data.comment ?? "",
      }),
    }),
};

export const companyResearcherApi = {
  /** Run the company researcher agent. discovery_id is optional but useful. */
  run: async (data: {
    company: string;
    discovery_id?: string;
    user_instructions?: string;
  }) => {
    const auth = await authHeader();
    const res = await fetch(`${API_URL}/api/agents/company-researcher/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        discovery_id: data.discovery_id ?? "",
        user_instructions: data.user_instructions ?? "",
        company: data.company,
      }),
    });
    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ detail: res.statusText }));
      const message = error.detail || "Company research failed";
      toast.error(message);
      throw new Error(message);
    }
    return res.json() as Promise<{
      agent_id: string;
      agent_name: string;
      data: CompanyProfileRecord;
    }>;
  },
  list: (discoveryId: string) =>
    request<CompanyProfileRecord[]>(
      `/api/agents/company-researcher/outputs/${discoveryId}`,
    ),
};
