"use client";

/**
 * UpdateBanner — surfaces "a new framework version is available" to the
 * customer without them having to check GHCR or release notes.
 *
 * Backend's GET /api/version compares the running framework version
 * against the latest GitHub release. When they differ, this banner
 * renders. Dismiss persists for the version it was dismissed for, so a
 * later release re-surfaces it.
 */

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

import { request } from "@/lib/http";

interface VersionInfo {
  running: string;
  latest: string;
  update_available: boolean;
}

const DISMISS_KEY = "core.update_dismissed_for";

export function UpdateBanner() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    request<VersionInfo>("/api/version")
      .then((next) => {
        if (cancelled) return;
        setInfo(next);
        if (typeof window !== "undefined" && next.update_available) {
          const dismissedFor = window.localStorage.getItem(DISMISS_KEY);
          if (dismissedFor === next.latest) setDismissed(true);
        }
      })
      .catch(() => {
        /* silent — banner is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info || !info.update_available || dismissed) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, info.latest);
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-2 border-b border-brand/30 bg-brand/5 px-4 py-2 text-xs">
      <span className="font-medium text-brand">CORE v{info.latest} available</span>
      <span className="text-muted-foreground">
        You're on v{info.running}. Run{" "}
        <code className="rounded bg-muted px-1 font-mono text-[11px]">
          npx create-core-discovery-app@latest
        </code>{" "}
        in your instance, then{" "}
        <code className="rounded bg-muted px-1 font-mono text-[11px]">
          docker compose pull &amp;&amp; docker compose up -d
        </code>
        .
      </span>
      <a
        href={`https://github.com/zitro/core-framework/releases/tag/v${info.latest}`}
        target="_blank"
        rel="noreferrer"
        className="ml-auto inline-flex items-center gap-1 text-brand hover:underline"
      >
        Release notes
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
