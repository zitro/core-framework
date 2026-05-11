"use client";

/**
 * /insights — cross-cutting lens over the active discovery.
 *
 * Each tab is a self-contained tool that aggregates data from
 * one or more phases. Tabs added incrementally as Phase 8 lands:
 *   Coverage (8A-1) — what's covered vs missing per phase
 *   Search (8A-2)   — full-text across the discovery
 *   Activity (8A-3) — recent generations, edits, comments, imports
 *   Inbox (8A-4)    — open questions + unread comments + risks
 *   Decisions       — captured decisions with rationale + timestamp
 *   Stakeholders    — visual of who's involved
 *
 * IA: lives off the sidebar as a top-level "Insights" nav item so it
 * doesn't bloat any phase page. Discovery context is implicit (active
 * discovery from the store).
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityFeed } from "@/components/insights/activity-feed";
import { CoverageMap } from "@/components/insights/coverage-map";
import { DecisionsLog } from "@/components/insights/decisions-log";
import { Inbox } from "@/components/insights/inbox";
import { SearchPanel } from "@/components/insights/search-panel";
import { StakeholderMap } from "@/components/insights/stakeholder-map";
import { DiscoveryRequired } from "@/components/layout/discovery-required";
import { PageHeader } from "@/components/layout/page-header";
import { useDiscovery } from "@/stores/discovery-store";
import { useTabParam } from "@/lib/use-tab-param";
import { Compass } from "lucide-react";

export default function InsightsPage() {
  const { activeDiscovery } = useDiscovery();
  const [activeTab, setActiveTab] = useTabParam("coverage");

  if (!activeDiscovery) {
    return <DiscoveryRequired phase="capture" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        eyebrow="Lens"
        title="Insights"
        description="Cross-cutting views over this discovery — what's covered, what's open, what's been decided."
        icon={Compass}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList variant="line" className="gap-3 border-b">
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
        </TabsList>

        <TabsContent value="coverage">
          <CoverageMap discoveryId={activeDiscovery.id} />
        </TabsContent>

        <TabsContent value="search">
          <SearchPanel discoveryId={activeDiscovery.id} />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityFeed discoveryId={activeDiscovery.id} />
        </TabsContent>

        <TabsContent value="inbox">
          <Inbox discoveryId={activeDiscovery.id} />
        </TabsContent>

        <TabsContent value="decisions">
          <DecisionsLog discoveryId={activeDiscovery.id} />
        </TabsContent>

        <TabsContent value="stakeholders">
          <StakeholderMap discoveryId={activeDiscovery.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
