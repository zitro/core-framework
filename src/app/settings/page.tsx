"use client";

import Link from "next/link";
import { Settings as SettingsIcon, ArrowRight, FolderGit2, Database, Server } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDiscovery } from "@/stores/discovery-store";

export default function SettingsPage() {
  const { activeDiscovery } = useDiscovery();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        eyebrow="Engagement settings"
        title="Settings"
        description="Provider configuration, environment, and discovery-wide preferences."
        icon={SettingsIcon}
        accent="brand"
      />

      {activeDiscovery && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sources & integrations</CardTitle>
            <CardDescription>
              Connect GitHub repos, local folders, and external knowledge bases for the active discovery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              render={<Link href="/capture" aria-label="Open Sources tab in Capture" />}
              variant="outline"
              size="sm"
              nativeButton={false}
            >
              Open Sources in Capture
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Source connections are managed inline with capture so the workflow stays continuous.
            </p>
          </CardContent>
        </Card>
      )}

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
          <div className="flex items-center gap-2 text-muted-foreground">
            <FolderGit2 className="h-4 w-4" aria-hidden />
            <span>
              Engagement repo for the active discovery is configured via{" "}
              <Link href="/capture" className="underline underline-offset-2">
                Capture → Sources
              </Link>
              .
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
