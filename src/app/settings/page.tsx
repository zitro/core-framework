"use client";

import { Settings as SettingsIcon, Database, Plug, Server } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        eyebrow="Engagement settings"
        title="Settings"
        description="Integrations, provider configuration, and engagement-wide preferences."
        icon={SettingsIcon}
        accent="brand"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>
            External services and tools. Source connections (GitHub repos, local folders)
            live on the Capture page with the rest of your discovery workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Plug className="h-4 w-4" aria-hidden />
            <span>No integrations configured yet.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider status</CardTitle>
          <CardDescription>
            Read-only summary of provider selection. Edit <code>.env</code> + redeploy to change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Server className="h-4 w-4" aria-hidden />
            <span>Backend health: visit <code>/api/health</code></span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4" aria-hidden />
            <span>Schema state: visit <code>/api/health/schema</code></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
