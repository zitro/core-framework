"use client";

/**
 * Settings — engagement, reviews, connections, and preferences in one place.
 * URL-driven tabs: ?tab=engagement|reviews|connections|preferences
 */

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileSliders, Settings2, Sliders, Users } from "lucide-react";

import ContextPage from "@/app/context/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerPanel } from "@/components/settings/customer-panel";

type Tab = "engagement" | "customer" | "preferences";
const TABS: Tab[] = ["engagement", "customer", "preferences"];

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
  const initial = (params.get("tab") as Tab) || "engagement";
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : "engagement");

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
            Engagement details, reviews, external connections, and personal preferences.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={onTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="engagement" className="gap-1.5">
            <FileSliders className="size-3.5" aria-hidden /> Engagement
          </TabsTrigger>
          <TabsTrigger value="customer" className="gap-1.5">
            <Users className="size-3.5" aria-hidden /> Customer
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5">
            <Sliders className="size-3.5" aria-hidden /> Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="mt-4">
          <ContextPage />
        </TabsContent>

        <TabsContent value="customer" className="mt-4">
          <CustomerPanel />
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <PreferencesPanel />
        </TabsContent>
      </Tabs>
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
