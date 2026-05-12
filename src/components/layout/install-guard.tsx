"use client";

/**
 * InstallGuard — blocks app boot until we've verified that the
 * customer_slug reported by /api/health matches what's cached in
 * localStorage. On mismatch, wipes every core.* / core:* key so the
 * downstream providers boot with empty state instead of cross-
 * contaminating from a previous customer install on the same browser.
 *
 * Must wrap every provider that reads localStorage (ProjectProvider,
 * DiscoveryProvider, etc.) so the wipe happens before their useState
 * initializers fire.
 */

import { useEffect, useState, type ReactNode } from "react";

const SLUG_KEY = "core.installSlug";

interface HealthResponse {
  customer_slug?: string;
}

async function fetchInstallSlug(signal: AbortSignal): Promise<string | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  try {
    const res = await fetch(`${apiUrl}/api/health`, { signal });
    if (!res.ok) return null;
    const body = (await res.json()) as HealthResponse;
    return body.customer_slug ?? "";
  } catch {
    return null;
  }
}

function wipeCoreKeys(): number {
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("core.") || key.startsWith("core:")) toRemove.push(key);
  }
  for (const key of toRemove) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  return toRemove.length;
}

export function InstallGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const liveSlug = await fetchInstallSlug(ctrl.signal);
      if (ctrl.signal.aborted) return;

      if (liveSlug !== null) {
        const cachedSlug = window.localStorage.getItem(SLUG_KEY);
        if (cachedSlug !== liveSlug) {
          const wiped = wipeCoreKeys();
          window.localStorage.setItem(SLUG_KEY, liveSlug);
          if (wiped > 0 && cachedSlug !== null) {
            console.info(
              `[CORE] Cleared ${wiped} cached entries from a previous install (${cachedSlug || "<unset>"} → ${liveSlug || "<unset>"}).`,
            );
          }
        }
      }
      setReady(true);
    })();
    return () => ctrl.abort();
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <div className="text-xs text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
