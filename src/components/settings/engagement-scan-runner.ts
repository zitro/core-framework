import { toast } from "sonner";
import type { EngagementScanResult, EngagementSourceType } from "@/types/core";
import { api } from "@/lib/api";
import { normalizeSourcePath } from "./engagement-helpers";

export interface ScanOutcome {
  result: EngagementScanResult;
  resolvedPath: string;
}

function reportLocalScanError(targetPath: string, message: string): void {
  const looksLikeFolderNameOnly = targetPath.length > 0 && !/[\\/]/.test(targetPath);
  const looksLikeWindowsPath = /^[A-Za-z]:[\\/]/.test(targetPath);
  if (looksLikeWindowsPath) {
    toast.error(
      "That Windows path is not visible inside the backend container. Use a mounted path like /data/projects/<folder> or a relative folder under PROJECTS_SOURCE.",
    );
  } else if (looksLikeFolderNameOnly) {
    toast.error(
      `Could not find '${targetPath}' in mounted projects. Try a mounted path such as /data/projects/${targetPath}, or update PROJECTS_SOURCE to include your folder.`,
    );
  } else {
    toast.error(
      `${message}. Use a path the backend can access (for example: /data/projects/<folder> or a relative folder under PROJECTS_SOURCE).`,
    );
  }
}

export async function runScan(
  type: EngagementSourceType,
  rawPath: string,
): Promise<ScanOutcome | null> {
  const targetPath = normalizeSourcePath(type, rawPath);
  if (!targetPath) return null;

  try {
    if (type === "local_folder") {
      const trimmed = targetPath.trim();
      const candidates = [trimmed];
      if (!/[\\/]/.test(trimmed)) {
        candidates.push(`projects/${trimmed}`);
        candidates.push(`/data/projects/${trimmed}`);
      }

      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const result = await api.engagement.scan(candidate);
          return { result, resolvedPath: candidate };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("Scan failed");
    }

    const result = await api.engagement.scan(targetPath);
    return { result, resolvedPath: targetPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    if (type === "local_folder") {
      reportLocalScanError(targetPath, message);
    } else {
      toast.error(`${message}. If the GitHub repository is private, set GITHUB_TOKEN for backend access.`);
    }
    return null;
  }
}
