"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { UseCaseVersion, Discovery } from "@/types/core";
import { api } from "@/lib/api";

interface UseCaseBuilderProps {
  discoveryId: string;
  activeDiscovery: Discovery;
}

export function UseCaseBuilder({ discoveryId, activeDiscovery }: UseCaseBuilderProps) {
  const [versions, setVersions] = useState<UseCaseVersion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [expanded, setExpanded] = useState(true);

  const loadVersions = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const items = await api.useCases.list(discoveryId);
      setVersions(items);
    } catch { /* non-critical */ }
  }, [discoveryId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.useCases.generate({
        discovery_id: discoveryId,
        user_instructions: instructions || undefined,
      });
      setVersions((prev) => [...prev, result]);
      setInstructions("");
    } catch { /* toast handled by api */ }
    finally { setGenerating(false); }
  };

  const latest = versions.length > 0 ? versions[versions.length - 1] : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Use Case Generator
          </CardTitle>
          <CardDescription>
            AI distills all your evidence, transcripts, and docs into a structured use case
            with business value and impact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Optional: Guide the AI — e.g., 'Focus on the compliance reporting pain point' or 'Target the portfolio management persona'"
            rows={2}
          />
          <Button onClick={generate} disabled={generating}>
            {generating ? "Generating..." : latest ? "Regenerate Use Case" : "Generate Use Case"}
          </Button>
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{latest.title || "Use Case"}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">v{latest.version}</Badge>
            </div>
            <CardDescription>{latest.persona}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Goal</p>
                <p className="text-sm">{latest.goal}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Current State</p>
                <p className="text-sm">{latest.current_state}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Desired State</p>
                <p className="text-sm">{latest.desired_state}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Estimated Effort</p>
                <p className="text-sm">{latest.business_impact || "—"}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Business Value</p>
              <p className="text-sm">{latest.business_value}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Business Impact</p>
              <p className="text-sm">{latest.business_impact}</p>
            </div>
            {latest.success_metrics.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Success Metrics</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {latest.success_metrics.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            <Separator />
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Summary</p>
              <p className="text-sm whitespace-pre-line">{latest.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {versions.length > 1 && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Version History
                <Badge variant="secondary" className="ml-2 text-[10px]">{versions.length}</Badge>
              </CardTitle>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {expanded && (
            <CardContent className="space-y-2">
              {[...versions].reverse().map((v) => (
                <div key={v.id} className="p-2 rounded border text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{v.version}: {v.title}</span>
                    <span className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{v.summary}</p>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
