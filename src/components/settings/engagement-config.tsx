"use client";

import { GitBranch } from "lucide-react";
import type { Discovery } from "@/types/core";
import { EngagementSourceActions } from "./engagement-source-actions";
import { EngagementConnectedSources } from "./engagement-connected-sources";
import { EngagementScanResults } from "./engagement-scan-results";
import { useEngagementSources } from "./use-engagement-sources";

interface EngagementConfigProps {
  discovery: Discovery;
  onUpdate: (patch: Partial<Discovery>) => void;
}

export function EngagementConfig({ discovery, onUpdate }: EngagementConfigProps) {
  const {
    connectedSources,
    localFolderPath,
    setLocalFolderPath,
    repositoryPath,
    setRepositoryPath,
    scan,
    scanningType,
    exporting,
    exportResult,
    planning,
    planResult,
    analyzingSources,
    sourceDuplicates,
    sourceVersions,
    checkingUpdates,
    updateStatuses,
    deletingSourceKey,
    addAndScanSource,
    removeConnectedSource,
    checkSourceUpdates,
    selectSource,
  } = useEngagementSources(discovery, onUpdate);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <span>Engagement Source</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Link a structured markdown repo to feed notes into AI context and export CORE outputs back.
        </p>
      </header>
      <div className="space-y-4">
        <EngagementSourceActions
          localFolderPath={localFolderPath}
          setLocalFolderPath={setLocalFolderPath}
          repositoryPath={repositoryPath}
          setRepositoryPath={setRepositoryPath}
          scanningType={scanningType}
          connectedCount={connectedSources.length}
          checkingUpdates={checkingUpdates}
          onAddAndScan={addAndScanSource}
          onCheckUpdates={checkSourceUpdates}
        />

        <EngagementConnectedSources
          connectedSources={connectedSources}
          scanningType={scanningType}
          deletingSourceKey={deletingSourceKey}
          updateStatuses={updateStatuses}
          onSelect={selectSource}
          onRemove={(source) => {
            void removeConnectedSource(source);
          }}
        />

        <EngagementScanResults
          scan={scan}
          exporting={exporting}
          planning={planning}
          analyzingSources={analyzingSources}
          exportResult={exportResult}
          planResult={planResult}
          sourceDuplicates={sourceDuplicates}
          sourceVersions={sourceVersions}
          connectedSources={connectedSources}
        />
      </div>
    </section>
  );
}
