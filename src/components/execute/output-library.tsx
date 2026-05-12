"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GeneratedPreview } from "@/components/execute/generated-preview";
import { OUTPUTS, categoryLabel, type OutputDefinition } from "@/components/execute/output-definitions";
import type { ExecuteOutputVersion } from "@/types/core";

interface OutputLibraryProps {
  generated: Record<string, ExecuteOutputVersion>;
  generatingOutputIds: string[];
  hydratingOutputs: boolean;
  onGenerate: (definition: OutputDefinition) => void;
  onCopy: (output: ExecuteOutputVersion) => void;
}

export function OutputLibrary({
  generated,
  generatingOutputIds,
  hydratingOutputs,
  onGenerate,
  onCopy,
}: OutputLibraryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />Output Library
        </CardTitle>
        <CardDescription>
          {hydratingOutputs
            ? "Loading saved final materials."
            : "Final materials generated from Capture, Orchestrate, Refine, and Execute context."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(categoryLabel).map(([category, label]) => (
          <div key={category} className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {OUTPUTS.filter((item) => item.category === category).map((item) => {
                const Icon = item.icon;
                const output = generated[item.id];
                const generating = generatingOutputIds.includes(item.id);
                const loadingSavedOutput = hydratingOutputs && !output;
                return (
                  <div key={item.id} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{item.title}</p>
                          {output && <Badge variant="secondary" className="text-[10px]">v{output.version}</Badge>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => onGenerate(item)} disabled={hydratingOutputs || generating}>
                        {loadingSavedOutput ? "Loading..." : generating ? "Generating..." : output ? "Regenerate" : "Generate"}
                      </Button>
                      {output && <Button size="sm" variant="outline" onClick={() => onCopy(output)}>Copy</Button>}
                    </div>
                    {output ? <GeneratedPreview output={output} /> : (loadingSavedOutput || generating) && (
                      <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                        {loadingSavedOutput ? "Loading the saved output for this discovery..." : "Building this output from the latest discovery data..."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
