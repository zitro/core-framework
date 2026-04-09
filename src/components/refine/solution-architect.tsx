"use client";

import { useCallback, useEffect, useState } from "react";
import { Cpu, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { SolutionBlueprint } from "@/types/core";
import { api } from "@/lib/api";

interface SolutionArchitectProps {
  discoveryId: string;
  providers: string[];
}

export function SolutionArchitect({ discoveryId, providers }: SolutionArchitectProps) {
  const [versions, setVersions] = useState<SolutionBlueprint[]>([]);
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const items = await api.blueprints.list(discoveryId);
      setVersions(items);
    } catch { /* non-critical */ }
  }, [discoveryId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.blueprints.generate({
        discovery_id: discoveryId,
        user_instructions: instructions || undefined,
      });
      setVersions((prev) => [...prev, result]);
      setInstructions("");
    } catch { /* toast handled */ }
    finally { setGenerating(false); }
  };

  const latest = versions.length > 0 ? versions[versions.length - 1] : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-500" />
            Solution Architect
          </CardTitle>
          <CardDescription>
            AI proposes a technical solution using{" "}
            <span className="font-medium">{providers.join(", ")}</span> services,
            including architecture, quick wins, and follow-up questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Optional: 'Focus on real-time data pipeline' or 'Keep it serverless' or 'Include cost estimates'"
            rows={2}
          />
          <Button onClick={generate} disabled={generating}>
            {generating ? "Architecting..." : latest ? "Regenerate Blueprint" : "Generate Blueprint"}
          </Button>
        </CardContent>
      </Card>

      {latest && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{latest.approach_title}</CardTitle>
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">v{latest.version}</Badge>
                  <Badge variant="outline" className="text-[10px]">{latest.estimated_effort}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-line">{latest.approach_summary}</p>

              <Separator />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                  Recommended Services
                </p>
                <div className="space-y-2">
                  {latest.services.map((s, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-emerald-500/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-[10px] bg-emerald-600">{s.service}</Badge>
                      </div>
                      <p className="text-xs"><span className="font-medium">Purpose:</span> {s.purpose}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  Architecture Overview
                </p>
                <p className="text-sm whitespace-pre-line">{latest.architecture_overview}</p>
              </div>

              {latest.quick_win_suggestion && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg border-2 border-dashed border-violet-500/30 bg-violet-500/5">
                    <p className="text-[10px] uppercase tracking-wider text-violet-600 font-medium mb-1">
                      Quick Win (1-2 weeks)
                    </p>
                    <p className="text-sm">{latest.quick_win_suggestion}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {(latest.follow_up_questions.length > 0 || latest.open_questions.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-500" />
                  Follow-up Questions
                </CardTitle>
                <CardDescription>
                  Questions to ask the customer and open items to resolve.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {latest.follow_up_questions.map((q, i) => (
                  <div key={`fq-${i}`} className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
                    onClick={() => navigator.clipboard.writeText(q)}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm">{q}</p>
                  </div>
                ))}
                {latest.open_questions.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Open Questions (internal)
                    </p>
                    {latest.open_questions.map((q, i) => (
                      <p key={`oq-${i}`} className="text-xs text-muted-foreground pl-3 border-l">
                        {q}
                      </p>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {versions.length > 1 && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setHistoryOpen(!historyOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Blueprint History
                <Badge variant="secondary" className="ml-2 text-[10px]">{versions.length}</Badge>
              </CardTitle>
              {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {historyOpen && (
            <CardContent className="space-y-2">
              {[...versions].reverse().map((v) => (
                <div key={v.id} className="p-2 rounded border text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{v.version}: {v.approach_title}</span>
                    <span className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {v.services.slice(0, 4).map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[9px]">{s.service}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
