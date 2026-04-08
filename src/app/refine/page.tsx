"use client";

import { useState } from "react";
import { FlaskConical, Target, Lightbulb, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PHASE_CONFIG } from "@/types/core";
import { api } from "@/lib/api";

const config = PHASE_CONFIG.refine;

interface Assumption {
  id: string;
  text: string;
  risk: "high" | "medium" | "low";
  status: "untested" | "validated" | "invalidated";
  test?: string;
}

interface SolutionMatch {
  problem: string;
  capabilities: string[];
  gap: string;
  confidence: number;
}

export default function RefinePage() {
  const [questions, setQuestions] = useState<{ text: string; purpose: string; follow_ups: string[] }[]>([]);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);

  // Assumption tracker
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [newAssumption, setNewAssumption] = useState("");
  const [newRisk, setNewRisk] = useState<"high" | "medium" | "low">("medium");

  // Solution Matcher
  const [problemInput, setProblemInput] = useState("");
  const [capabilitiesInput, setCapabilitiesInput] = useState("");
  const [matches, setMatches] = useState<SolutionMatch[]>([]);
  const [matching, setMatching] = useState(false);

  const generateQuestions = async () => {
    setGenerating(true);
    try {
      const result = await api.questions.generate({
        discovery_id: "demo",
        phase: "refine",
        context,
      });
      setQuestions(result.questions);
    } catch {
      setQuestions([
        { text: "What's the riskiest assumption in our current solution direction?", purpose: "Prioritize validation", follow_ups: ["How would we know if it's wrong?"] },
        { text: "Can we test this with a paper prototype before building anything?", purpose: "Cheapest valid test", follow_ups: ["What decision does the test inform?"] },
        { text: "What existing capability could partially solve this today?", purpose: "Solution matching", follow_ups: ["What gap remains after using what we have?"] },
        { text: "If we could only deliver one thing, what would move the needle most?", purpose: "Scope cutting", follow_ups: ["What's the evidence for that?"] },
        { text: "Who would need to say yes for this to ship?", purpose: "Map approval chain", follow_ups: ["What do they care about most?"] },
      ]);
    } finally {
      setGenerating(false);
    }
  };

  const addAssumption = () => {
    if (!newAssumption.trim()) return;
    setAssumptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: newAssumption, risk: newRisk, status: "untested" },
    ]);
    setNewAssumption("");
  };

  const updateAssumption = (id: string, status: Assumption["status"]) => {
    setAssumptions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const runSolutionMatcher = async () => {
    setMatching(true);
    try {
      // In a real implementation this calls the AI backend
      await new Promise((r) => setTimeout(r, 800));
      setMatches([
        {
          problem: problemInput || "Scheduling visibility across departments",
          capabilities: capabilitiesInput.split(",").map((s) => s.trim()).filter(Boolean),
          gap: "Real-time sync between systems not currently supported",
          confidence: 65,
        },
      ]);
    } finally {
      setMatching(false);
    }
  };

  const riskColor = { high: "text-red-500", medium: "text-amber-500", low: "text-emerald-500" };
  const riskBg = { high: "bg-red-500/10", medium: "bg-amber-500/10", low: "bg-emerald-500/10" };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <FlaskConical className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.label}</h1>
          <p className="text-muted-foreground text-sm">{config.description}</p>
        </div>
      </div>

      <Tabs defaultValue="assumptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assumptions" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Assumptions
          </TabsTrigger>
          <TabsTrigger value="matcher" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Solution Matcher
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assumptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assumption Tracker</CardTitle>
              <CardDescription>
                List your assumptions, rank by risk, and track validation status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newAssumption}
                  onChange={(e) => setNewAssumption(e.target.value)}
                  placeholder="e.g., Users will adopt a unified calendar view"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && addAssumption()}
                />
                <select
                  value={newRisk}
                  onChange={(e) => setNewRisk(e.target.value as Assumption["risk"])}
                  className="rounded-md border px-3 text-sm"
                  title="Risk level"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <Button onClick={addAssumption} size="sm">Add</Button>
              </div>

              {assumptions.length > 0 && (
                <div className="space-y-2">
                  {assumptions
                    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] - { high: 0, medium: 1, low: 2 }[b.risk]))
                    .map((a) => (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <Badge variant="outline" className={`${riskBg[a.risk]} ${riskColor[a.risk]} border-0`}>
                          {a.risk}
                        </Badge>
                        <span className="text-sm flex-1">{a.text}</span>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant={a.status === "validated" ? "default" : "ghost"}
                            className="h-7 w-7"
                            onClick={() => updateAssumption(a.id, "validated")}
                            title="Validated"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant={a.status === "invalidated" ? "destructive" : "ghost"}
                            className="h-7 w-7"
                            onClick={() => updateAssumption(a.id, "invalidated")}
                            title="Invalidated"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Generate Refine Questions</p>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Describe your current solution direction and key assumptions..."
                  rows={3}
                />
                <Button onClick={generateQuestions} disabled={generating} className="mt-2">
                  {generating ? "Generating..." : "Generate Questions"}
                </Button>
              </div>

              {questions.length > 0 && (
                <div className="space-y-2 mt-4">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigator.clipboard.writeText(q.text)}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{q.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">Purpose: {q.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matcher" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Solution Matcher</CardTitle>
              <CardDescription>
                Bridge &quot;we understand the problem&quot; to &quot;here&apos;s what solves it.&quot;
                Map problems to existing capabilities and identify gaps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Problem to solve</label>
                <Textarea value={problemInput} onChange={(e) => setProblemInput(e.target.value)}
                  placeholder="e.g., Clinical staff need real-time visibility into scheduling across 3 departments"
                  rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium">Known capabilities (comma-separated)</label>
                <Textarea value={capabilitiesInput} onChange={(e) => setCapabilitiesInput(e.target.value)}
                  placeholder="e.g., Epic scheduling module, Teams integration, Power Automate flows, custom SharePoint dashboard"
                  rows={2} />
              </div>
              <Button onClick={runSolutionMatcher} disabled={matching}>
                {matching ? "Matching..." : "Find Solution Matches"}
              </Button>

              {matches.length > 0 && (
                <>
                  <Separator />
                  {matches.map((m, i) => (
                    <Card key={i} className="border-emerald-500/20">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Problem</p>
                          <p className="text-sm font-medium">{m.problem}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Matched Capabilities</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {m.capabilities.map((c, j) => (
                              <Badge key={j} variant="secondary">{c}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Gap</p>
                          <p className="text-sm text-amber-600">{m.gap}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Confidence</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              {/* eslint-disable-next-line react/forbid-dom-props */}
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${m.confidence}%` }} />
                            </div>
                            <span className="text-xs font-medium">{m.confidence}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
