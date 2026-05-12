import { toast } from "sonner";
import type {
  EngagementContentResult,
  EngagementSource,
} from "@/types/core";
import { api } from "@/lib/api";
import {
  isVersionType,
  normalizeText,
  type SourceDuplicate,
  type SourceVersionGroup,
} from "./engagement-helpers";

export interface AnalysisResult {
  duplicates: SourceDuplicate[];
  versions: SourceVersionGroup[];
}

export async function analyzeSourcesAcross(
  connectedSources: EngagementSource[],
): Promise<AnalysisResult> {
  if (connectedSources.length < 2) {
    return { duplicates: [], versions: [] };
  }

  const loaded = await Promise.all(
    connectedSources.map(async (source) => {
      try {
        const content = await api.engagement.content(source.value);
        return { source: source.value, content };
      } catch {
        return { source: source.value, content: null as EngagementContentResult | null };
      }
    }),
  );

  const duplicatesMap = new Map<string, { type: string; title: string; sources: Set<string> }>();
  const versionsMap = new Map<string, SourceVersionGroup>();

  for (const loadedSource of loaded) {
    if (!loadedSource.content) continue;
    for (const file of loadedSource.content.content) {
      const normalizedType = normalizeText(file.type || "other");
      const normalizedTitle = normalizeText(file.title || file.path);
      const normalizedBody = normalizeText((file.body || "").slice(0, 1400));
      const duplicateKey = `${normalizedType}|${normalizedTitle}|${normalizedBody}`;
      const current = duplicatesMap.get(duplicateKey) ?? {
        type: file.type || "other",
        title: file.title || file.path,
        sources: new Set<string>(),
      };
      current.sources.add(loadedSource.source);
      duplicatesMap.set(duplicateKey, current);

      if (isVersionType(file.type || "")) {
        const versionGroupKey = `${normalizedType}|${normalizedTitle}`;
        const group = versionsMap.get(versionGroupKey) ?? {
          key: versionGroupKey,
          type: file.type || "other",
          title: file.title || file.path,
          entries: [],
        };
        const entryKey = `${loadedSource.source}:${file.path}`;
        if (!group.entries.some((e) => `${e.source}:${e.path}` === entryKey)) {
          group.entries.push({
            source: loadedSource.source,
            path: file.path,
            excerpt: (file.body || "").replace(/\s+/g, " ").trim().slice(0, 180),
          });
        }
        versionsMap.set(versionGroupKey, group);
      }
    }
  }

  const duplicates = Array.from(duplicatesMap.entries())
    .map(([key, value]) => ({
      key,
      type: value.type,
      title: value.title,
      sources: Array.from(value.sources),
      count: value.sources.size,
    }))
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  const versions = Array.from(versionsMap.values())
    .filter((group) => group.entries.length > 1)
    .sort((a, b) => b.entries.length - a.entries.length || a.title.localeCompare(b.title));

  if (duplicates.length > 0) {
    toast.info(`Detected ${duplicates.length} duplicate item groups across connected sources`);
  }

  return { duplicates, versions };
}
