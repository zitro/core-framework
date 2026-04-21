import { toast } from "sonner";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type TokenGetter = (opts?: { forceRefresh?: boolean }) => Promise<string | null>;

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
  const auth = await authHeader({ forceRefresh });
  return fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...options?.headers,
    },
    ...options,
  });
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
    const message = error.detail || "API request failed";
    if (res.status !== 401) toast.error(message);
    throw new Error(message);
  }
  return res.json();
}
