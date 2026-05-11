/** Project-wide (corpus-grounded) chat endpoints. */

import { request } from "@/lib/http";
import type {
  SynthesisChatReply,
  SynthesisChatSession,
  SynthesisChatTurn,
} from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export const chatApi = {
  chat: (projectId: string, message: string, sessionId = "") =>
    request<SynthesisChatReply>(`/api/synthesis/${pid(projectId)}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, session_id: sessionId }),
    }),

  chatHistory: (projectId: string, sessionId: string) =>
    request<{ session_id: string; turns: SynthesisChatTurn[] }>(
      `/api/synthesis/${pid(projectId)}/chat/${encodeURIComponent(sessionId)}`,
    ),

  chatSessions: (projectId: string) =>
    request<{ sessions: SynthesisChatSession[] }>(
      `/api/synthesis/${pid(projectId)}/chat`,
    ),
};
