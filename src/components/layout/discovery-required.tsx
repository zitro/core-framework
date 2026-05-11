"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Compass, Lightbulb, Rocket, Plus, type LucideIcon } from "lucide-react";
import type { CorePhase } from "@/types/core";
import { PHASE_CONFIG } from "@/types/core";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

const PHASE_ICONS: Record<CorePhase, LucideIcon> = {
  capture: Search,
  orchestrate: Compass,
  refine: Lightbulb,
  execute: Rocket,
};

const PHASE_EYEBROW: Record<CorePhase, string> = {
  capture: "Phase 1 · Capture",
  orchestrate: "Phase 2 · Orchestrate",
  refine: "Phase 3 · Refine",
  execute: "Phase 4 · Execute",
};

/**
 * Cold-start surface rendered when a phase route loads without an
 * active discovery selected. Matches the look of the loaded page
 * (same PageHeader treatment + accent bar) so opening a phase route
 * with no discovery isn't a visual cliff from the rest of the app.
 */
export function DiscoveryRequired({ phase }: { phase: CorePhase }) {
  const router = useRouter();
  const config = PHASE_CONFIG[phase];
  const Icon = PHASE_ICONS[phase];

  const startNewDiscovery = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("core:start-new-discovery"));
    }
    router.push("/?newDiscovery=1");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        eyebrow={PHASE_EYEBROW[phase]}
        title={config.label}
        description={config.description}
        icon={Icon}
        accent={phase}
      />
      <EmptyState
        icon={Icon}
        title="No active discovery"
        description={`Pick an existing discovery or start a new one to begin ${config.label.toLowerCase()}.`}
        actions={
          <>
            <Button size="sm" onClick={startNewDiscovery}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
              Start new discovery
            </Button>
            <Button
              render={<Link href="/" aria-label="Open dashboard" />}
              variant="outline"
              size="sm"
              nativeButton={false}
            >
              Open dashboard
            </Button>
          </>
        }
      />
    </div>
  );
}
