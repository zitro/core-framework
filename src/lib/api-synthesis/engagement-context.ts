/** Engagement context — read-only project brief used to ground synthesis. */

import { request } from "@/lib/http";

export interface EngagementContextRecord {
  project_id: string;
  customer_name: string;
  industry: string;
  outcome: string;
  scope: string;
  constraints: string;
  ways_of_working: string;
  updated_at: string;
}

const pid = (id: string) => encodeURIComponent(id);

export const engagementContextApi = {
  get: (projectId: string) =>
    request<EngagementContextRecord>(`/api/engagement-context/${pid(projectId)}`),
};
