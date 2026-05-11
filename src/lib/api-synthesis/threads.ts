/**
 * Per-artifact threads + grounded chat (Phase 6F backend).
 *
 * The push-to-engagement-repo endpoint is NOT shipped on main yet (Phase
 * 6J). The client method is included for shape parity; UI surfaces that
 * call it must render a disabled "coming soon" state until backend lands.
 */

import { request } from "@/lib/http";
import type {
  ArtifactChatTurnResponse,
  ArtifactCommentRecord,
  ArtifactPushResult,
  ArtifactThreadRecord,
} from "@/types/synthesis";

const pid = (id: string) => encodeURIComponent(id);

export const threadsApi = {
  get: (projectId: string, artifactId: string) =>
    request<{ thread: ArtifactThreadRecord; comments: ArtifactCommentRecord[] }>(
      `/api/synthesis/${pid(projectId)}/artifacts/${pid(artifactId)}/thread`,
    ),

  postComment: (
    projectId: string,
    artifactId: string,
    data: { body: string; role?: "user" | "system"; author?: string },
  ) =>
    request<ArtifactCommentRecord>(
      `/api/synthesis/${pid(projectId)}/artifacts/${pid(artifactId)}/comments`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  deleteComment: (projectId: string, artifactId: string, commentId: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/synthesis/${pid(projectId)}/artifacts/${pid(artifactId)}/comments/${pid(commentId)}`,
      { method: "DELETE" },
    ),

  chat: (
    projectId: string,
    artifactId: string,
    data: { body: string; author?: string },
  ) =>
    request<ArtifactChatTurnResponse>(
      `/api/synthesis/${pid(projectId)}/artifacts/${pid(artifactId)}/chat`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  /** Push a single artifact to the connected engagement-repo. */
  push: (projectId: string, artifactId: string) =>
    request<ArtifactPushResult>(
      `/api/synthesis/${pid(projectId)}/artifacts/${pid(artifactId)}/push`,
      { method: "POST" },
    ),
};
