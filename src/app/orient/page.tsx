"use client";

import { useState } from "react";
import { Compass, Network, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PHASE_CONFIG } from "@/types/core";
import { api } from "@/lib/api";

const config = PHASE_CONFIG.orient;

export default function OrientPage() {
  const [questions, setQuestions] = useState<{ text: string; purpose: string; follow_ups: string[] }[]>([]);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);

  // Problem Statement Builder state
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [impact, setImpact] = useState("");

  const generateQuestions = async () => {
    setGenerating(true);
    try {
      const result = await api.questions.generate({
        discovery_id: "demo",
        phase: "orient",
        context,
      });
      setQuestions(result.questions);
    } catch {
      setQuestions([
        { text: "What patterns are you seeing across the interviews?", purpose: "Cross-reference evidence", follow_ups: ["Are there contradictions?"] },
        { text: "Is the stated problem the real problem, or a symptom?", purpose: "Root cause analysis", follow_ups: ["What evidence supports each interpretation?"] },
        { text: "Who benefits from the current broken process?", purpose: "Systems thinking — find resistance", follow_ups: ["What would they lose if we fix it?"] },
        { text: "What assumptions are we making that we haven't validated?", purpose: "Surface blind spots", follow_ups: ["How could we test each one cheaply?"] },
        { text: "If we mapped cause and effect, where is the leverage point?", purpose: "Systems map identification", follow_ups: ["What's the smallest change with biggest impact?"] },
        { text: "What are three different ways to frame this problem?", purpose: "Divergent framing", follow_ups: ["Which framing changes what we'd build?"] },
      ]);
    } finally {
      setGenerating(false);
    }
  };

  const problemStatement =
    who && what
      ? `${who} need a way to ${what}${why ? ` because ${why}` : ""}${impact ? `. If solved, ${impact}` : ""}.`
      : "";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <Compass className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.label}</h1>
          <p className="text-muted-foreground text-sm">{config.description}</p>
        </div>
      </div>

      <Tabs defaultValue="sensemaking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sensemaking" className="gap-1.5">
            <Network className="h-3.5 w-3.5" />
            Sensemaking
          </TabsTrigger>
          <TabsTrigger value="problem" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Problem Statement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sensemaking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orient Context</CardTitle>
              <CardDescription>
                What evidence have you captured? The AI will generate sensemaking questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., We interviewed 5 clinical staff. Common themes: slow system, duplicate data entry, workarounds for scheduling. But the IT team says the system is fine."
                rows={4}
              />
              <Button onClick={generateQuestions} disabled={generating}>
                {generating ? "Generating..." : "Generate Orient Questions"}
              </Button>
            </CardContent>
          </Card>

          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Sensemaking Questions
                  <Badge variant="secondary" className="ml-2">{questions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((q, i) => (
                  <div key={i}>
                    <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigator.clipboard.writeText(q.text)}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{q.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">Purpose: {q.purpose}</p>
                      </div>
                    </div>
                    {i < questions.length - 1 && <Separator className="mt-2" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="problem" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Problem Statement Builder</CardTitle>
              <CardDescription>
                Frame the real problem using evidence. A good problem statement prevents solution-jumping.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Who is affected?</label>
                <Textarea value={who} onChange={(e) => setWho(e.target.value)}
                  placeholder="e.g., Clinical staff who manage patient scheduling across 3 departments"
                  rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium">What do they need?</label>
                <Textarea value={what} onChange={(e) => setWhat(e.target.value)}
                  placeholder="e.g., see real-time schedule availability without switching between systems"
                  rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium">Why? (root cause)</label>
                <Textarea value={why} onChange={(e) => setWhy(e.target.value)}
                  placeholder="e.g., the current system requires manual cross-referencing of 3 separate calendars"
                  rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium">Impact if solved</label>
                <Textarea value={impact} onChange={(e) => setImpact(e.target.value)}
                  placeholder="e.g., scheduling errors drop by 60% and staff saves 2 hours per day"
                  rows={2} />
              </div>

              {problemStatement && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-xs uppercase tracking-wider text-amber-600 font-medium mb-2">
                      Problem Statement
                    </p>
                    <p className="text-sm font-medium leading-relaxed">{problemStatement}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
