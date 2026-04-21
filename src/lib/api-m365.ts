import { request } from "@/lib/http";

export interface GraphFile {
  id: string;
  name: string;
  web_url: string;
  last_modified: string;
  size: number;
  snippet: string;
}

export interface GraphMessage {
  id: string;
  subject: string;
  sender: string;
  received: string;
  web_url: string;
  snippet: string;
}

export interface GraphMeeting {
  id: string;
  subject: string;
  organizer: string;
  start: string;
  end: string;
  join_url: string;
  snippet: string;
}

export interface CrmAccount {
  id: string;
  name: string;
  industry: string;
  revenue: string;
  website: string;
  primary_contact: string;
  snippet: string;
}

export interface GroundingCitation {
  index: number;
  title: string;
  url: string;
}

export interface GroundingResult {
  answer: string;
  confidence: "low" | "medium" | "high" | string;
  follow_ups: string[];
  citations: GroundingCitation[];
}

export interface GroundingResponse {
  question: string;
  snippets: Array<{
    index: number;
    title: string;
    url: string;
    snippet: string;
  }>;
  result: GroundingResult;
}

export const m365Api = {
  graphStatus: () => request<{ enabled: boolean }>("/api/graph/status"),
  searchFiles: (q: string, limit = 10) =>
    request<{ enabled: boolean; query: string; items: GraphFile[] }>(
      `/api/graph/files?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  searchMessages: (q: string, limit = 10) =>
    request<{ enabled: boolean; query: string; items: GraphMessage[] }>(
      `/api/graph/messages?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  meetings: (days = 7, limit = 20) =>
    request<{ enabled: boolean; items: GraphMeeting[] }>(
      `/api/graph/meetings?days=${days}&limit=${limit}`,
    ),

  dynamicsStatus: () => request<{ enabled: boolean }>("/api/dynamics/status"),
  searchAccounts: (q: string, limit = 10) =>
    request<{ enabled: boolean; query: string; items: CrmAccount[] }>(
      `/api/dynamics/accounts?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  ground: (question: string, limit = 6) =>
    request<GroundingResponse>("/api/grounding/answer", {
      method: "POST",
      body: JSON.stringify({ question, limit }),
    }),
};
