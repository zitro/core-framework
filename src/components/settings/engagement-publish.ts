import { toast } from "sonner";
import type {
  EngagementExportResult,
  EngagementPublishResult,
  EngagementSource,
} from "@/types/core";
import { api } from "@/lib/api";

export async function runExport(
  discoveryId: string,
  activePath: string,
): Promise<EngagementExportResult | null> {
  if (!discoveryId || !activePath.trim()) return null;
  try {
    const result = await api.engagement.export({
      discovery_id: discoveryId,
      repo_path: activePath.trim(),
    });
    toast.success(`Exported ${result.count} files`);
    return result;
  } catch {
    return null;
  }
}

export async function runPlanPublish(
  discoveryId: string,
  connectedSources: EngagementSource[],
): Promise<EngagementPublishResult | null> {
  if (!discoveryId || connectedSources.length === 0) return null;
  try {
    const result = await api.engagement.publish({
      discovery_id: discoveryId,
      repo_paths: connectedSources.map((s) => s.value),
      dry_run: true,
      use_ai_placement: true,
    });
    toast.success(`Auto plan publish ready (${result.count} items)`);
    return result;
  } catch {
    return null;
  }
}
