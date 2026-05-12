import { toast } from "sonner";
import type {
  EngagementSource,
  EngagementSourceUpdateStatus,
} from "@/types/core";
import { api } from "@/lib/api";
import { fingerprintFromScan } from "./engagement-helpers";

function readSnapshot(key: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeSnapshot(key: string, value: Record<string, string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function runCheckSourceUpdates(
  connectedSources: EngagementSource[],
  snapshotKey: string,
): Promise<EngagementSourceUpdateStatus[]> {
  if (connectedSources.length === 0) return [];

  const previous = readSnapshot(snapshotKey);
  const next: Record<string, string> = { ...previous };
  const statuses: EngagementSourceUpdateStatus[] = [];

  for (const source of connectedSources) {
    const key = `${source.type}:${source.value}`;
    try {
      const result = await api.engagement.scan(source.value, { refresh: true });
      const currentFingerprint = fingerprintFromScan(result);
      const previousFingerprint = previous[key] || "";
      const changed = !!previousFingerprint && previousFingerprint !== currentFingerprint;
      next[key] = currentFingerprint;
      statuses.push({
        type: source.type,
        value: source.value,
        checked_at: new Date().toISOString(),
        changed,
        previous_fingerprint: previousFingerprint,
        current_fingerprint: currentFingerprint,
        file_count: result.files.length,
      });
    } catch (error) {
      statuses.push({
        type: source.type,
        value: source.value,
        checked_at: new Date().toISOString(),
        changed: false,
        previous_fingerprint: previous[key] || "",
        current_fingerprint: previous[key] || "",
        file_count: 0,
        error: error instanceof Error ? error.message : "Update check failed",
      });
    }
  }

  writeSnapshot(snapshotKey, next);

  const changedCount = statuses.filter((s) => s.changed).length;
  if (changedCount > 0) {
    toast.info(`${changedCount} source(s) have new or changed data available`);
  } else {
    toast.success("No source updates detected");
  }

  return statuses;
}

export function removeSnapshotEntry(snapshotKey: string, entryKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(snapshotKey);
    if (!raw) return;
    const current = JSON.parse(raw) as Record<string, string>;
    delete current[entryKey];
    window.localStorage.setItem(snapshotKey, JSON.stringify(current));
  } catch {
    /* ignore localStorage failures */
  }
}
