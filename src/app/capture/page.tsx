"use client";

/**
 * /capture — drop raw input, run connectors, and source content into the
 * project corpus. Sub-tabs are URL-driven (?tab=…) so legacy redirects
 * land users on the right one.
 */

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  FileSliders,
  Globe,
  Inbox,
  type LucideIcon,
  Plug,
  Upload,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/stores/project-store";
import { DropZone } from "@/components/capture/drop-zone";
import { ConnectorsPanel } from "@/components/synthesis/connectors-panel";
import { CompanyPanel } from "@/components/sources/company-panel";
import { WebSearchPanel } from "@/components/sources/web-search-panel";
import ContextPage from "@/app/context/page";

type Tab = "drop" | "engagement" | "connectors" | "company" | "web";
const TABS: Tab[] = ["drop", "engagement", "connectors", "company", "web"];

interface TabDef {
  value: Tab;
  label: string;
  icon: LucideIcon;
}

const TAB_DEFS: TabDef[] = [
  { value: "drop", label: "Drop-zone", icon: Upload },
  { value: "engagement", label: "Engagement context", icon: FileSliders },
  { value: "connectors", label: "Connectors", icon: Plug },
  { value: "company", label: "Company", icon: Building2 },
  { value: "web", label: "Web", icon: Globe },
];

export default function CapturePage() {
  return (
    <Suspense fallback={null}>
      <CaptureInner />
    </Suspense>
  );
}

function CaptureInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) || "drop";
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : "drop");
  const { activeProject } = useProject();

  const onTab = useCallback(
    (next: string) => {
      setTab(next as Tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
    },
    [router],
  );

  const projectId = activeProject?.id || "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-blue-500" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Capture</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Bring information into the project. The drop-zone turns raw text into
          typed artifact candidates with a dry-run preview before anything is
          saved.
        </p>
      </header>

      <Tabs value={tab} onValueChange={onTab}>
        <TabsList className="grid w-full grid-cols-5">
          {TAB_DEFS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <Icon className="size-3.5" aria-hidden /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="drop" className="mt-4">
          <DropZone projectId={projectId} />
        </TabsContent>

        <TabsContent value="engagement" className="mt-4">
          <ContextPage />
        </TabsContent>

        <TabsContent value="connectors" className="mt-4">
          {projectId ? (
            <ConnectorsPanel projectId={projectId} />
          ) : (
            <NoProjectPlaceholder />
          )}
        </TabsContent>

        <TabsContent value="company" className="mt-4">
          <CompanyPanel />
        </TabsContent>

        <TabsContent value="web" className="mt-4">
          <WebSearchPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoProjectPlaceholder() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <p>Select an active project to manage its connectors.</p>
      </CardContent>
    </Card>
  );
}
