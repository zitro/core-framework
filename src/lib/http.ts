import { toast } from "sonner";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Parse timeout from environment, ensure it's at least 5 seconds (5000ms)
const parsedTimeout = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || "30000");
const API_TIMEOUT_MS = Math.max(
  Number.isFinite(parsedTimeout) ? parsedTimeout : 30000,
  5000
);

type TokenGetter = (opts?: { forceRefresh?: boolean }) => Promise<string | null>;

let activeProjectId: string | null = null;

/** Set the active project; sent as ``X-Project-Id`` on every API request. */
export function setActiveProjectId(id: string | null): void {
  activeProjectId = id;
}

export function getActiveProjectId(): string | null {
  return activeProjectId;
}

function normalizeErrorDetail(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const msg = (item as { msg?: unknown }).msg;
          return typeof msg === "string" ? msg : "";
        }
        return "";
      })
      .filter((value) => value.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }
  if (detail && typeof detail === "object") {
    if ("msg" in detail) {
      const msg = (detail as { msg?: unknown }).msg;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return "API request failed";
    }
  }
  return "API request failed";
}

function projectHeader(): Record<string, string> {
  return activeProjectId ? { "X-Project-Id": activeProjectId } : {};
}

function tokenGetter(): TokenGetter | null {
  if (typeof window === "undefined") return null;
  return (
    window as unknown as { __coreGetToken?: TokenGetter }
  ).__coreGetToken ?? null;
}

function signInRequired(): void {
  if (typeof window === "undefined") return;
  const trigger = (
    window as unknown as { __coreRequireSignIn?: () => Promise<void> }
  ).__coreRequireSignIn;
  if (trigger) {
    void trigger();
  }
}

export async function authHeader(
  opts?: { forceRefresh?: boolean },
): Promise<Record<string, string>> {
  const getter = tokenGetter();
  if (!getter) return {};
  try {
    const token = await getter(opts);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function fetchWithAuth(
  path: string,
  options: RequestInit | undefined,
  forceRefresh: boolean,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const auth = await authHeader({ forceRefresh });
  try {
    return await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...auth,
        ...projectHeader(),
        ...options?.headers,
      },
      signal: controller.signal,
      ...options,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${API_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let res = await fetchWithAuth(path, options, false);
  if (res.status === 401 && tokenGetter()) {
    // Try once more with a forced silent token refresh.
    res = await fetchWithAuth(path, options, true);
    if (res.status === 401) {
      signInRequired();
    }
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    const message = normalizeErrorDetail(error.detail);
    if (res.status !== 401) toast.error(message);
    throw new Error(message);
  }
  return res.json();
}

/** Fetch a binary payload (e.g. .docx, .pptx). Returns the blob and the
 * server-suggested filename if one was supplied via Content-Disposition. */
export async function requestBlob(
  path: string,
  options?: RequestInit,
): Promise<{ blob: Blob; filename: string | null }> {
  let res = await fetchWithAuth(path, options, false);
  if (res.status === 401 && tokenGetter()) {
    res = await fetchWithAuth(path, options, true);
    if (res.status === 401) signInRequired();
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    const message = normalizeErrorDetail(error.detail);
    if (res.status !== 401) toast.error(message);
    throw new Error(message);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(cd);
  return { blob, filename: match ? match[1] : null };
}
