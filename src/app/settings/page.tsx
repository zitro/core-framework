"use client";

/**
 * Settings — customer connections, integrations, and preferences.
 * Engagement-context editing now lives in /capture (Engagement context tab).
 * URL-driven tabs: ?tab=customer|connections|preferences
 */

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  GitBranch,
  Plug,
  Settings2,
  Sliders,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerPanel } from "@/components/settings/customer-panel";
import { GraphConnectionPanel } from "@/components/settings/graph-connection-panel";

type Tab = "customer" | "connections" | "preferences";
const TABS: Tab[] = ["customer", "connections", "preferences"];

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) || "customer";
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : "customer");

  const onTab = useCallback(
    (next: string) => {
      setTab(next as Tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10">
          <Settings2 className="h-5 w-5 text-slate-500" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Customer entities, external connections, and personal preferences.
            (Engagement context now lives in <Link href="/capture?tab=engagement" className="underline">Capture → Engagement context</Link>.)
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={onTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customer" className="gap-1.5">
            <Users className="size-3.5" aria-hidden /> Customer
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-1.5">
            <Plug className="size-3.5" aria-hidden /> Connections
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5">
            <Sliders className="size-3.5" aria-hidden /> Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="mt-4">
          <CustomerPanel />
        </TabsContent>

        <TabsContent value="connections" className="mt-4">
          <ConnectionsPanel />
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <PreferencesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionsPanel() {
  return (
    <div className="space-y-4">
      <GraphConnectionPanel />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="size-4" aria-hidden /> GitHub (vertex repo)
          </CardTitle>
          <CardDescription>
            CORE Discovery reads and writes your engagement&apos;s vertex repo
            through a Source on the active customer. Add a GitHub source there
            with a personal access token and pick &quot;Vertex&quot; as the role.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/settings?tab=customer";
            }}
          >
            Manage customer sources
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open("https://github.com/settings/tokens?type=beta", "_blank")
            }
          >
            Create a GitHub token
            <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connectors per project</CardTitle>
          <CardDescription>
            Per-project connectors (web search, HTTP JSON, page crawlers) are
            configured in <Link href="/capture?tab=connectors" className="underline">Capture → Connectors</Link>.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function PreferencesPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Theme follows your system preference. Switch via the toggle in the header.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vertex write-back</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Bidirectional write-back to the connected vertex repo is controlled per project via the
          project metadata flag <code>vertex.metadata.write_enabled</code>. A UI toggle is on the
          roadmap.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          CORE Framework — see the in-app methodology view for the design-thinking mapping.
        </CardContent>
      </Card>
    </div>
  );
}
