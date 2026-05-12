"use client";

import { FolderGit2 } from "lucide-react";
import type { Discovery } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { EngagementConfig } from "@/components/settings/engagement-config";
import { BrowsePanel } from "@/components/capture/discover/browse-panel";

interface Props {
  activeDiscovery: Discovery;
}

export function CaptureSourcesTab({ activeDiscovery }: Props): React.ReactElement {
  const { setActiveDiscovery } = useDiscovery();

  return (
    <>
      <section className="relative overflow-hidden rounded-xl border bg-card">
        <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-brand" aria-hidden />
        <div className="space-y-2 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <FolderGit2 className="h-3.5 w-3.5" />
            <span>Anchor — start here</span>
          </div>
          <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Connect your engagement repo
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Sources is where CORE gets its facts. Point it at the engagement repo, register external connectors,
            and the rest of Capture, Orchestrate, Refine, and Execute work from that ground truth.
          </p>
        </div>
      </section>
      <EngagementConfig
        discovery={activeDiscovery}
        onUpdate={(patch) => {
          api.discoveries.update(activeDiscovery.id, patch).then((updated) => {
            setActiveDiscovery(updated);
          }).catch(() => {});
        }}
      />
      <BrowsePanel hidePathInput />
    </>
  );
}
