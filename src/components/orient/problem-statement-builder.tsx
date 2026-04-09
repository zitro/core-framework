"use client";

import { useEffect, useState } from "react";
import { Sparkles, History, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProblemStatementVersion, Discovery } from "@/types/core";
import { api } from "@/lib/api";

interface ProblemStatementBuilderProps {
  discoveryId: string;
  activeDiscovery: Discovery | null;
}

export function ProblemStatementBuilder({ discoveryId, activeDiscovery }: ProblemStatementBuilderProps) {
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [impact, setImpact] = useState("");
  const [statementText, setStatementText] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const [psVersions, setPsVersions] = useState<ProblemStatementVersion[]>([]);
  const [generatingPS, setGeneratingPS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!discoveryId) return;
    api.problemStatements.list(discoveryId).then((versions) => {
      setPsVersions(versions);
      if (versions.length > 0) {
        const latest = versions[versions.length - 1];
        setWho(latest.who);
        setWhat(latest.what);
        setWhy(latest.why);
        setImpact(latest.impact);
        setStatementText(latest.statement);
      }
    }).catch(() => { /* non-critical */ });
  }, [discoveryId]);

  useEffect(() => {
    if (psVersions.length > 0) return;
    const ps = activeDiscovery?.problem_statement;
    if (ps) {
      setWho(ps.who || "");
      setWhat(ps.what || "");
      setWhy(ps.why || "");
      setImpact(ps.impact || "");
      if (ps.statement) setStatementText(ps.statement);
    }
  }, [activeDiscovery?.id, activeDiscovery?.problem_statement, psVersions.length]);

  const generate = async () => {
    setGeneratingPS(true);
    setError(null);
    try {
      const result = await api.problemStatements.generate({
        discovery_id: discoveryId,
        user_instructions: userInstructions || undefined,
      });
      setPsVersions((prev) => [...prev, result]);
      setWho(result.who);
      setWhat(result.what);
      setWhy(result.why);
      setImpact(result.impact);
      setStatementText(result.statement);
      setUserInstructions("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate problem statement");
    } finally {
      setGeneratingPS(false);
    }
  };

  const save = async () => {
    const id = activeDiscovery?.id;
    if (!id) return;
    setSaving(true);
    try {
      await api.discoveries.update(id, {
        problem_statement: { who, what, why, impact, statement: statementText, confidence: "assumed" },
      } as Partial<Discovery>);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const loadVersion = (v: ProblemStatementVersion) => {
    setWho(v.who);
    setWhat(v.what);
    setWhy(v.why);
    setImpact(v.impact);
    setStatementText(v.statement);
    setShowHistory(false);
  };

  return (
    <div className="space-y-4">
      {/* AI Generation */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Problem Statement Generator
              </CardTitle>
              <CardDescription>
                AI synthesizes all your evidence, transcripts, and questions into a problem statement.
              </CardDescription>
            </div>
            {psVersions.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
                <History className="h-3.5 w-3.5 mr-1.5" />
                v{psVersions.length}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={userInstructions}
            onChange={(e) => setUserInstructions(e.target.value)}
            placeholder="Optional: guide the AI — e.g., 'Focus on ops team pain points'"
            rows={2}
          />
          <Button onClick={generate} disabled={generatingPS}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {generatingPS ? "Generating..." : psVersions.length > 0 ? "Regenerate" : "Generate"}
          </Button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {/* Version History */}
      {showHistory && psVersions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-60">
              <div className="space-y-2">
                {psVersions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => loadVersion(v)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">v{v.version}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm truncate">{v.statement}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-2 shrink-0">Load</Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Editable Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Problem Statement
          </CardTitle>
          <CardDescription>
            Edit the AI-generated statement or write your own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statementText && (
            <>
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <p className="text-xs uppercase tracking-wider text-amber-600 font-medium mb-2">
                  Full Statement {psVersions.length > 0 && `(v${psVersions.length})`}
                </p>
                <Textarea
                  value={statementText}
                  onChange={(e) => setStatementText(e.target.value)}
                  className="border-0 bg-transparent p-0 text-sm font-medium leading-relaxed resize-none focus-visible:ring-0"
                  rows={4}
                />
              </div>
              <Separator />
            </>
          )}
          <div>
            <label className="text-sm font-medium">Who is affected?</label>
            <Textarea value={who} onChange={(e) => setWho(e.target.value)}
              placeholder="e.g., Portfolio managers who execute trades across 3 asset classes" rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">What do they need?</label>
            <Textarea value={what} onChange={(e) => setWhat(e.target.value)}
              placeholder="e.g., see real-time portfolio exposure without switching between systems" rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">Why? (root cause)</label>
            <Textarea value={why} onChange={(e) => setWhy(e.target.value)}
              placeholder="e.g., manual cross-referencing of 3 separate ledgers" rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">Impact if solved</label>
            <Textarea value={impact} onChange={(e) => setImpact(e.target.value)}
              placeholder="e.g., reconciliation errors drop by 60%, analysts save 2 hours/day" rows={2} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} variant="outline">
              {saving ? "Saving..." : "Save Problem Statement"}
            </Button>
            {(who || what) && (
              <Button
                onClick={() => {
                  setUserInstructions(`Incorporate these edits — Who: ${who}; What: ${what}; Why: ${why}; Impact: ${impact}`);
                  generate();
                }}
                disabled={generatingPS}
                variant="secondary"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Regenerate with My Edits
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
