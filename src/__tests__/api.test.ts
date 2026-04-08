import { describe, it, expect, vi, beforeEach } from "vitest";

const API_URL = "http://localhost:8000";

// Re-implement a minimal request function to test API logic
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

describe("API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes GET requests with correct URL", async () => {
    const mockData = [{ id: "1", name: "Test" }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await request("/api/discovery/");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/discovery/",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    expect(result).toEqual(mockData);
  });

  it("throws on non-ok responses with detail", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "Not found" }),
    });

    await expect(request("/api/discovery/bad")).rejects.toThrow("Not found");
  });

  it("throws generic message when no detail in error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("parse fail")),
    });

    await expect(request("/api/health")).rejects.toThrow("Internal Server Error");
  });

  it("sends POST with JSON body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "new-1", name: "Created" }),
    });

    const body = { name: "New Discovery" };
    await request("/api/discovery/", {
      method: "POST",
      body: JSON.stringify(body),
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/discovery/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      })
    );
  });
});
