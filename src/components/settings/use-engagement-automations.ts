"use client";

import { useEffect, useRef, useState } from "react";
import type {
  EngagementExportResult,
  EngagementPublishResult,
  EngagementScanResult,
  EngagementSource,
} from "@/types/core";
import { type SourceDuplicate, type SourceVersionGroup } from "./engagement-helpers";
import { runExport, runPlanPublish } from "./engagement-publish";
import { analyzeSourcesAcross } from "./engagement-source-analysis";

export interface UseEngagementAutomationsResult {
  exporting: boolean;
  exportResult: EngagementExportResult | null;
  planning: boolean;
  planResult: EngagementPublishResult | null;
  analyzingSources: boolean;
  sourceDuplicates: SourceDuplicate[];
  sourceVersions: SourceVersionGroup[];
}

export function useEngagementAutomations(
  discoveryId: string | undefined,
  activePath: string,
  scan: EngagementScanResult | null,
  connectedSources: EngagementSource[],
): UseEngagementAutomationsResult {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<EngagementExportResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planResult, setPlanResult] = useState<EngagementPublishResult | null>(null);
  const [analyzingSources, setAnalyzingSources] = useState(false);
  const [sourceDuplicates, setSourceDuplicates] = useState<SourceDuplicate[]>([]);
  const [sourceVersions, setSourceVersions] = useState<SourceVersionGroup[]>([]);

  const automationRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!discoveryId || !scan || scan.error || !activePath.trim()) return;
    if (connectedSources.length === 0) return;
    const sourceKey = connectedSources
      .map((s) => `${s.type}:${s.value}`)
      .sort()
      .join("|");
    const key = `${discoveryId}:${activePath.trim()}:${sourceKey}`;
    if (automationRef.current.has(key)) return;
    automationRef.current.add(key);

    void (async () => {
      setExporting(true);
      setExportResult(null);
      const exportRes = await runExport(discoveryId, activePath);
      if (exportRes) setExportResult(exportRes);
      setExporting(false);

      setPlanning(true);
      const planRes = await runPlanPublish(discoveryId, connectedSources);
      if (planRes) setPlanResult(planRes);
      setPlanning(false);

      if (connectedSources.length < 2) {
        setSourceDuplicates([]);
        setSourceVersions([]);
        return;
      }
      setAnalyzingSources(true);
      try {
        const { duplicates, versions } = await analyzeSourcesAcross(connectedSources);
        setSourceDuplicates(duplicates);
        setSourceVersions(versions);
      } finally {
        setAnalyzingSources(false);
      }
    })();
  }, [activePath, connectedSources, discoveryId, scan]);

  return {
    exporting,
    exportResult,
    planning,
    planResult,
    analyzingSources,
    sourceDuplicates,
    sourceVersions,
  };
}
