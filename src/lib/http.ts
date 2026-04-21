import { toast } from "sonner";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function authHeader(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const getter = (
    window as unknown as { __coreGetToken?: () => Promise<string | null> }
  ).__coreGetToken;
  if (!getter) return {};
  try {
    const token = await getter();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const auth = await authHeader();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: res.statusText }));
    const message = error.detail || "API request failed";
    toast.error(message);
    throw new Error(message);
  }
  return res.json();
}
