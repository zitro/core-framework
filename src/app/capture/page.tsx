"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/lib/use-tab-param";
import { useDiscovery } from "@/stores/discovery-store";
import { PhaseShell } from "@/components/layout/phase-shell";
import { DiscoveryRequired } from "@/components/layout/discovery-required";
import { CaptureSourcesTab } from "@/components/capture/capture-sources-tab";
import { CaptureContextTab } from "@/components/capture/capture-context-tab";
import { CaptureDiscoverTab } from "@/components/capture/capture-discover-tab";
import { CaptureTechnologiesTab } from "@/components/capture/capture-technologies-tab";
import { useCaptureDraft } from "@/components/capture/use-capture-draft";

export default function CapturePage(): React.ReactElement {
  const { activeDiscovery } = useDiscovery();
  const [activeTab, setActiveTab] = useTabParam("sources");
  const draft = useCaptureDraft(activeDiscovery);

  if (!activeDiscovery) {
    return <DiscoveryRequired phase="capture" />;
  }

  const discoveryId = activeDiscovery.id;

  return (
    <PhaseShell
      phase="capture"
      discoveryId={discoveryId}
      showEvidencePanel={false}
      showDtMethodsPanel={false}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="technologies">Technologies</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <CaptureSourcesTab activeDiscovery={activeDiscovery} />
        </TabsContent>

        <TabsContent value="context" className="space-y-4">
          <CaptureContextTab
            discoveryId={discoveryId}
            quickNote={draft.quickNote}
            setQuickNote={draft.setQuickNote}
            captureItemType={draft.captureItemType}
            setCaptureItemType={draft.setCaptureItemType}
            captureReference={draft.captureReference}
            setCaptureReference={draft.setCaptureReference}
          />
        </TabsContent>

        <TabsContent value="technologies" className="space-y-4">
          <CaptureTechnologiesTab
            discoveryId={discoveryId}
            technologyInput={draft.technologyInput}
            setTechnologyInput={draft.setTechnologyInput}
            technologyFocusInput={draft.technologyFocusInput}
            setTechnologyFocusInput={draft.setTechnologyFocusInput}
            technologyTargets={draft.technologyTargets}
            setTechnologyTargets={draft.setTechnologyTargets}
          />
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          <CaptureDiscoverTab />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
