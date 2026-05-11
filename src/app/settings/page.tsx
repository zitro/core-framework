"use client";

import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Cloud,
  Database,
  Server,
  Mail,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
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
  setup?: React.ReactNode;
  openHref?: string;
  openLabel?: string;
}

function Integration({
  icon: Icon,
  name,
  description,
  status,
  setup,
  openHref,
  openLabel = "Open",
}: IntegrationProps) {
  const [expanded, setExpanded] = useState(false);
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
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
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
        <div className="flex shrink-0 items-center gap-1.5">
          {status === "connected" && openHref && (
            <Button
              variant="outline"
              size="xs"
              render={<Link href={openHref} aria-label={openLabel} />}
              nativeButton={false}
            >
              {openLabel}
            </Button>
          )}
          {setup && (
            <Button
              variant={status === "connected" ? "ghost" : "outline"}
              size="xs"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {status === "connected" ? "Reconfigure" : "Connect"}
            </Button>
          )}
        </div>
      </div>
      {setup && expanded && (
        <div className="border-t border-border bg-muted/30 px-3 py-3">
          {setup}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (typeof navigator === "undefined") return;
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-5 text-foreground/90">
        {children}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={copy}
        className="absolute right-1 top-1"
        aria-label="Copy"
      >
        <Copy className="h-3 w-3" aria-hidden />
      </Button>
      {copied && (
        <span className="absolute right-7 top-1.5 text-[10px] text-muted-foreground">
          Copied
        </span>
      )}
    </div>
  );
}

function M365Setup() {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium">1. Register an Entra ID app</p>
        <p className="text-xs text-muted-foreground">
          In your Azure portal:{" "}
          <a
            href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            Entra ID → App registrations <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          . Note the Tenant ID, Application (client) ID, and create a client
          secret (Certificates &amp; secrets → New client secret).
        </p>
      </div>
      <div>
        <p className="font-medium">2. Grant Graph permissions</p>
        <p className="text-xs text-muted-foreground">
          API permissions → Microsoft Graph → Application permissions:{" "}
          <code>Files.Read.All</code>, <code>Mail.Read</code>,{" "}
          <code>Calendars.Read</code>, <code>User.Read.All</code>,{" "}
          <code>OnlineMeetings.Read.All</code>. Then click <strong>Grant admin consent</strong>.
        </p>
      </div>
      <div>
        <p className="font-medium">3. Add to your customer&apos;s <code>.env</code></p>
        <CodeBlock>{`GRAPH_PROVIDER=azure
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<client-id>
AZURE_CLIENT_SECRET=<client-secret>`}</CodeBlock>
      </div>
      <div>
        <p className="font-medium">4. Restart the backend</p>
        <p className="text-xs text-muted-foreground">
          <code>docker compose restart</code> does NOT reload env_file.
          Use <code>--force-recreate</code>:
        </p>
        <CodeBlock>docker compose up -d --force-recreate backend</CodeBlock>
      </div>
      <p className="text-xs text-muted-foreground">
        After the backend comes back up, the status badge above will flip to{" "}
        <em>Connected</em>.
      </p>
    </div>
  );
}

function GoogleSetup() {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        The Google Workspace connector isn&apos;t wired into the backend yet —
        no <code>GOOGLE_PROVIDER</code> env is read. When it ships, the steps
        will mirror Microsoft 365: register an OAuth client in Google Cloud
        Console, grant Workspace API scopes, and drop the credentials into{" "}
        <code>.env</code>.
      </p>
      <p className="text-xs text-muted-foreground">
        Tracking: deferred to Phase 6 (Synthesis subsystem port from master).
      </p>
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
            openHref="/m365"
            openLabel="Open M365"
            setup={<M365Setup />}
          />
          <Integration
            icon={Mail}
            name="Google Workspace"
            description="Gmail, Drive, Calendar, and Meet recordings via Google Workspace APIs."
            status="not-configured"
            setup={<GoogleSetup />}
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
