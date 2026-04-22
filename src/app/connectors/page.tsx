"use client";

import { useState } from "react";
import { Plug } from "lucide-react";

import { ConnectorsPanel } from "@/components/synthesis/connectors-panel";
import { useProject } from "@/stores/project-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ConnectorsPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? "";
  const [sources, setSources] = useState<Record<string, unknown>>({});

  return (
    <main className="container mx-auto p-6 max-w-5xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
          <Plug className="h-5 w-5 text-cyan-500" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
          <p className="text-muted-foreground text-sm">
            Configure GitHub, web, and JSON API sources for the active project.
          </p>
        </div>
      </header>

      {projectId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{activeProject?.name}</CardTitle>
            <CardDescription>
              Saved configurations feed straight into the synthesis corpus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectorsPanel
              projectId={projectId}
              initialSources={sources}
              onSaved={setSources}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Plug className="h-7 w-7 text-muted-foreground" aria-hidden />
            <p className="font-medium">No project selected</p>
            <p className="text-sm text-muted-foreground">
              Pick a project from the switcher in the sidebar to configure connectors.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
