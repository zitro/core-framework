"use client";

/**
 * Sources — unified discovery inputs (Connectors, Company, Web, Evidence).
 * URL-driven tabs: ?tab=connectors|company|web|evidence
 */

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Building2, Globe, Layers, Plug } from "lucide-react";

import { ConnectorsPanel } from "@/components/synthesis/connectors-panel";
import { EvidenceBoard } from "@/components/evidence-board";
import { CompanyPanel } from "@/components/sources/company-panel";
import { WebSearchPanel } from "@/components/sources/web-search-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/stores/project-store";

type Tab = "connectors" | "company" | "web" | "evidence";
const TABS: Tab[] = ["connectors", "company", "web", "evidence"];

export default function SourcesPage() {
  return (
    <Suspense fallback={null}>
      <SourcesInner />
    </Suspense>
  );
}

function SourcesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) || "connectors";
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : "connectors");
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? "";
  const [sources, setSources] = useState<Record<string, unknown>>({});

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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
          <Layers className="h-5 w-5 text-cyan-500" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="text-sm text-muted-foreground">
            Everything that feeds the project — internal connectors, company research, web, and
            captured evidence.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={onTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connectors" className="gap-1.5">
            <Plug className="size-3.5" aria-hidden /> Connectors
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="size-3.5" aria-hidden /> Company
          </TabsTrigger>
          <TabsTrigger value="web" className="gap-1.5">
            <Globe className="size-3.5" aria-hidden /> Web
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1.5">
            <BookOpen className="size-3.5" aria-hidden /> Evidence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="mt-4">
          {projectId ? (
            <ConnectorsPanel
              projectId={projectId}
              initialSources={sources}
              onSaved={setSources}
            />
          ) : (
            <EmptyHint message="Select a project in the sidebar to configure connectors." />
          )}
        </TabsContent>

        <TabsContent value="company" className="mt-4">
          <CompanyPanel />
        </TabsContent>

        <TabsContent value="web" className="mt-4">
          <WebSearchPanel />
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <EvidenceBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
