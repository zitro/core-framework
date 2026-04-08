"use client";

import { useState } from "react";
import { Rocket, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PHASE_CONFIG } from "@/types/core";

const config = PHASE_CONFIG.execute;

interface QuickWin {
  id: string;
  title: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  owner: string;
  done: boolean;
}

interface Blocker {
  id: string;
  description: string;
  severity: "critical" | "major" | "minor";
  mitigation: string;
  resolved: boolean;
}

export default function ExecutePage() {
  // Quick Wins
  const [wins, setWins] = useState<QuickWin[]>([]);
  const [winTitle, setWinTitle] = useState("");
  const [winEffort, setWinEffort] = useState<QuickWin["effort"]>("low");
  const [winImpact, setWinImpact] = useState<QuickWin["impact"]>("high");
  const [winOwner, setWinOwner] = useState("");

  // Blockers
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [blockerDesc, setBlockerDesc] = useState("");
  const [blockerSeverity, setBlockerSeverity] = useState<Blocker["severity"]>("major");
  const [blockerMitigation, setBlockerMitigation] = useState("");

  // Handoff
  const [handoffNotes, setHandoffNotes] = useState("");

  const addWin = () => {
    if (!winTitle.trim()) return;
    setWins((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: winTitle, effort: winEffort, impact: winImpact, owner: winOwner, done: false },
    ]);
    setWinTitle("");
    setWinOwner("");
  };

  const toggleWin = (id: string) => {
    setWins((prev) => prev.map((w) => (w.id === id ? { ...w, done: !w.done } : w)));
  };

  const addBlocker = () => {
    if (!blockerDesc.trim()) return;
    setBlockers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: blockerDesc, severity: blockerSeverity, mitigation: blockerMitigation, resolved: false },
    ]);
    setBlockerDesc("");
    setBlockerMitigation("");
  };

  const toggleBlocker = (id: string) => {
    setBlockers((prev) => prev.map((b) => (b.id === id ? { ...b, resolved: !b.resolved } : b)));
  };

  const effortColor = { low: "text-emerald-500", medium: "text-amber-500", high: "text-red-500" };
  const impactColor = { low: "text-muted-foreground", medium: "text-amber-500", high: "text-emerald-600" };
  const severityColor = { critical: "bg-red-500/10 text-red-500", major: "bg-amber-500/10 text-amber-500", minor: "bg-blue-500/10 text-blue-500" };

  const completedWins = wins.filter((w) => w.done).length;
  const resolvedBlockers = blockers.filter((b) => b.resolved).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
          <Rocket className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.label}</h1>
          <p className="text-muted-foreground text-sm">{config.description}</p>
        </div>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{completedWins}/{wins.length}</p>
            <p className="text-xs text-muted-foreground">Quick Wins Done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{resolvedBlockers}/{blockers.length}</p>
            <p className="text-xs text-muted-foreground">Blockers Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{wins.length > 0 && blockers.filter((b) => !b.resolved && b.severity === "critical").length === 0 ? "Ready" : "Not Yet"}</p>
            <p className="text-xs text-muted-foreground">Handoff Status</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wins" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wins" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Quick Wins
          </TabsTrigger>
          <TabsTrigger value="blockers" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Blockers
          </TabsTrigger>
          <TabsTrigger value="handoff" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Handoff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Win Tracker</CardTitle>
              <CardDescription>
                Focus on minimal-effort, high-impact actions that demonstrate value fast.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                <div>
                  <label className="text-xs font-medium">What</label>
                  <Input value={winTitle} onChange={(e) => setWinTitle(e.target.value)} placeholder="Quick win title"
                    onKeyDown={(e) => e.key === "Enter" && addWin()} />
                </div>
                <div>
                  <label className="text-xs font-medium">Effort</label>
                  <select value={winEffort} onChange={(e) => setWinEffort(e.target.value as QuickWin["effort"])}
                    className="flex h-9 w-full rounded-md border px-3 text-sm" title="Effort level">
                    <option value="low">Low</option>
                    <option value="medium">Med</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Impact</label>
                  <select value={winImpact} onChange={(e) => setWinImpact(e.target.value as QuickWin["impact"])}
                    className="flex h-9 w-full rounded-md border px-3 text-sm" title="Impact level">
                    <option value="high">High</option>
                    <option value="medium">Med</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Owner</label>
                  <Input value={winOwner} onChange={(e) => setWinOwner(e.target.value)} placeholder="Name" className="w-28" />
                </div>
                <Button onClick={addWin} size="sm">Add</Button>
              </div>

              {wins.length > 0 && (
                <div className="space-y-2">
                  {wins.map((w) => (
                    <div key={w.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${w.done ? "bg-muted/50 opacity-60" : ""}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => toggleWin(w.id)}>
                        <CheckCircle2 className={`h-4 w-4 ${w.done ? "text-emerald-500" : "text-muted-foreground"}`} />
                      </Button>
                      <span className={`text-sm flex-1 ${w.done ? "line-through" : ""}`}>{w.title}</span>
                      <span className={`text-xs ${effortColor[w.effort]}`}>Effort: {w.effort}</span>
                      <span className={`text-xs ${impactColor[w.impact]}`}>Impact: {w.impact}</span>
                      {w.owner && <Badge variant="outline" className="text-xs">{w.owner}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blockers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Blocker Remediation</CardTitle>
              <CardDescription>
                Track blockers and their mitigations. Critical blockers block handoff.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={blockerDesc} onChange={(e) => setBlockerDesc(e.target.value)}
                    placeholder="Describe the blocker" className="flex-1" />
                  <select value={blockerSeverity} onChange={(e) => setBlockerSeverity(e.target.value as Blocker["severity"])}
                    className="rounded-md border px-3 text-sm" title="Blocker severity">
                    <option value="critical">Critical</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Input value={blockerMitigation} onChange={(e) => setBlockerMitigation(e.target.value)}
                    placeholder="Mitigation plan" className="flex-1" />
                  <Button onClick={addBlocker} size="sm">Add</Button>
                </div>
              </div>

              {blockers.length > 0 && (
                <div className="space-y-2">
                  {blockers
                    .sort((a, b) => ({ critical: 0, major: 1, minor: 2 }[a.severity] - { critical: 0, major: 1, minor: 2 }[b.severity]))
                    .map((b) => (
                      <div key={b.id} className={`p-3 rounded-lg border space-y-1 ${b.resolved ? "opacity-60" : ""}`}>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => toggleBlocker(b.id)}>
                            <CheckCircle2 className={`h-4 w-4 ${b.resolved ? "text-emerald-500" : "text-muted-foreground"}`} />
                          </Button>
                          <Badge variant="outline" className={`border-0 ${severityColor[b.severity]}`}>
                            {b.severity}
                          </Badge>
                          <span className={`text-sm flex-1 ${b.resolved ? "line-through" : ""}`}>{b.description}</span>
                        </div>
                        {b.mitigation && (
                          <p className="text-xs text-muted-foreground ml-9">Mitigation: {b.mitigation}</p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="handoff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RPI Handoff Package</CardTitle>
              <CardDescription>
                Summarize findings, recommendations, and next steps for the implementation team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-emerald-500/20">
                  <CardContent className="pt-4">
                    <p className="text-xs uppercase tracking-wider text-emerald-600 font-medium mb-1">Validated</p>
                    <p className="text-2xl font-bold">{wins.filter((w) => w.done).length} wins</p>
                    <p className="text-xs text-muted-foreground">delivered and confirmed</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/20">
                  <CardContent className="pt-4">
                    <p className="text-xs uppercase tracking-wider text-amber-600 font-medium mb-1">Open</p>
                    <p className="text-2xl font-bold">{blockers.filter((b) => !b.resolved).length} blockers</p>
                    <p className="text-xs text-muted-foreground">requiring attention</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium">Handoff Notes &amp; Recommendations</label>
                <Textarea value={handoffNotes} onChange={(e) => setHandoffNotes(e.target.value)}
                  placeholder="Summarize: what was discovered, what was validated, what the team should build next, and any caveats..."
                  rows={6} />
              </div>

              <Button className="w-full" disabled={blockers.some((b) => !b.resolved && b.severity === "critical")}>
                {blockers.some((b) => !b.resolved && b.severity === "critical")
                  ? "Resolve Critical Blockers Before Handoff"
                  : "Generate Handoff Document"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
