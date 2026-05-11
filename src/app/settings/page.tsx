"use client";

import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Cloud,
  Database,
  Server,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { m365Api } from "@/lib/api-m365";

type Status = "loading" | "connected" | "not-configured" | "unknown";

interface IntegrationProps {
  icon: typeof Cloud;
  name: string;
  description: string;
  status: Status;
  manageHref?: string;
  manageLabel?: string;
}

function Integration({
  icon: Icon,
  name,
  description,
  status,
  manageHref,
  manageLabel = "Configure",
}: IntegrationProps) {
  const badgeVariant = status === "connected" ? "default" : "outline";
  const badgeLabel =
    status === "loading"
      ? "Checking…"
      : status === "connected"
        ? "Connected"
        : status === "not-configured"
          ? "Not configured"
          : "Unknown";

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium leading-tight">{name}</p>
            <Badge variant={badgeVariant} className="text-[10px]">
              {badgeLabel}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {manageHref && (
        <Button
          variant="outline"
          size="xs"
          disabled={status === "loading"}
          onClick={() => {
            if (typeof window !== "undefined") window.open(manageHref, "_blank");
          }}
        >
          {manageLabel}
        </Button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [graphStatus, setGraphStatus] = useState<Status>("loading");

  useEffect(() => {
    m365Api
      .graphStatus()
      .then((s) => setGraphStatus(s.enabled ? "connected" : "not-configured"))
      .catch(() => setGraphStatus("unknown"));
  }, []);

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
            External services Discovery can read from. Source folders and GitHub
            repos for an individual discovery live on the Capture page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Integration
            icon={Cloud}
            name="Microsoft 365 (Graph)"
            description="OneDrive / SharePoint files, Outlook messages, Teams meetings, and Dynamics 365 accounts."
            status={graphStatus}
            manageHref="/m365"
            manageLabel="Open M365"
          />
          <Integration
            icon={Mail}
            name="Google Workspace"
            description="Gmail, Drive, Calendar, and Meet recordings via Google Workspace APIs. Not yet wired."
            status="not-configured"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider status</CardTitle>
          <CardDescription>
            Read-only summary of provider selection. Edit <code>.env</code> +
            redeploy to change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Server className="h-4 w-4" aria-hidden />
            <span>
              Backend health: visit <code>/api/health</code>
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4" aria-hidden />
            <span>
              Schema state: visit <code>/api/health/schema</code>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
