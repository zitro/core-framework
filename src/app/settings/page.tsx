"use client";

import Link from "next/link";
import { Settings as SettingsIcon, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EngagementConfig } from "@/components/settings/engagement-config";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";

export default function SettingsPage() {
  const { activeDiscovery, setActiveDiscovery } = useDiscovery();

  if (!activeDiscovery) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          eyebrow="Discovery settings"
          title="Settings"
          description="Sources, scans, exports, and publishing for the active discovery."
          icon={SettingsIcon}
          accent="brand"
        />
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <SettingsIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Select or create a discovery to configure its sources.
          </p>
          <Button
            render={<Link href="/" aria-label="Go to Dashboard" />}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        eyebrow={activeDiscovery.name || "Discovery settings"}
        title="Settings"
        description="Sources, scans, exports, and publishing for the active discovery."
        icon={SettingsIcon}
        accent="brand"
      />
      <EngagementConfig
        discovery={activeDiscovery}
        onUpdate={(patch) => {
          api.discoveries
            .update(activeDiscovery.id, patch)
            .then((updated) => setActiveDiscovery(updated))
            .catch(() => {});
        }}
      />
    </div>
  );
}
