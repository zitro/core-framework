"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Target, Lightbulb, Cpu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SolutionMatch, Assumption, QuestionSet } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";
import { AssumptionTracker } from "@/components/refine/assumption-tracker";
import { SolutionMatcherPanel } from "@/components/refine/solution-matcher-panel";
import { SolutionArchitect } from "@/components/refine/solution-architect";
import { PhaseShell } from "@/components/layout/phase-shell";

export default function RefinePage() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id || "";

  const [questions, setQuestions] = useState<{ text: string; purpose: string; follow_ups: string[] }[]>([]);
  const [savedQuestionSets, setSavedQuestionSets] = useState<QuestionSet[]>([]);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solution Matcher
  const [problemInput, setProblemInput] = useState("");
  const [capabilitiesInput, setCapabilitiesInput] = useState("");
  const [matches, setMatches] = useState<SolutionMatch[]>([]);
  const [matching, setMatching] = useState(false);

  // Assumptions
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);

  // Load problem statement from Orient and persisted assumptions
  useEffect(() => {
    const ps = activeDiscovery?.problem_statement;
    if (ps?.statement && !problemInput) {
      setProblemInput(ps.statement);
    }
    if (activeDiscovery?.assumptions?.length) {
      setAssumptions(activeDiscovery.assumptions);
    }
    if (activeDiscovery?.solution_matches?.length) {
      setMatches(activeDiscovery.solution_matches);
    }
  }, [activeDiscovery?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved question sets for this phase
  useEffect(() => {
    if (!discoveryId) return;
    api.questions.list(discoveryId, "refine").then((sets) => {
      setSavedQuestionSets(sets);
      if (sets.length > 0 && questions.length === 0) {
        const latest = sets[sets.length - 1];
        setQuestions(latest.questions);
        if (latest.context) setContext(latest.context);
      }
    }).catch(() => { /* non-critical */ });
  }, [discoveryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist assumptions to backend
  const persistAssumptions = useCallback(
    async (updated: Assumption[]) => {
      if (!discoveryId) return;
      try {
        await api.discoveries.update(discoveryId, { assumptions: updated } as Partial<import("@/types/core").Discovery>);
      } catch { /* non-critical */ }
    },
    [discoveryId]
  );

  // Persist solution matches to backend
  const persistMatches = useCallback(
    async (updated: SolutionMatch[]) => {
      if (!discoveryId) return;
      try {
        await api.discoveries.update(discoveryId, { solution_matches: updated } as Partial<import("@/types/core").Discovery>);
      } catch { /* non-critical */ }
    },
    [discoveryId]
  );

  const handleAssumptionsChange = (updated: Assumption[]) => {
    setAssumptions(updated);
    persistAssumptions(updated);
  };

  const generateQuestions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.questions.generate({
        discovery_id: discoveryId,
        phase: "refine",
        context,
      });
      setQuestions(result.questions);
      setSavedQuestionSets((prev) => [...prev, result]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate questions — is the backend running?");
    } finally {
      setGenerating(false);
    }
  };

  const runSolutionMatcher = async () => {
    setMatching(true);
    try {
      const capabilities = capabilitiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await api.questions.solutionMatch({
        discovery_id: discoveryId,
        problem: problemInput,
        capabilities,
      });
      setMatches(result.matches);
      persistMatches(result.matches);
    } catch (e) {
      setMatches([
        {
          problem: problemInput || "Problem description",
          capabilities: [],
          gap: e instanceof Error ? e.message : "AI service unavailable — is the backend running?",
          confidence: 0,
        },
      ]);
    } finally {
      setMatching(false);
    }
  };

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <FlaskConical className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Select or create a discovery from the Dashboard to start refining.</p>
      </div>
    );
  }

  return (
    <PhaseShell phase="refine" discoveryId={discoveryId}>
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
          <TabsTrigger value="architect" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Solution Architect
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assumptions" className="space-y-4">
          <AssumptionTracker
            assumptions={assumptions}
            onAssumptionsChange={handleAssumptionsChange}
            context={context}
            onContextChange={setContext}
            generating={generating}
            onGenerate={generateQuestions}
            error={error}
            questions={questions}
          />
        </TabsContent>

        <TabsContent value="matcher" className="space-y-4">
          <SolutionMatcherPanel
            problemInput={problemInput}
            onProblemChange={setProblemInput}
            capabilitiesInput={capabilitiesInput}
            onCapabilitiesChange={setCapabilitiesInput}
            matches={matches}
            matching={matching}
            onMatch={runSolutionMatcher}
          />
        </TabsContent>

        <TabsContent value="architect" className="space-y-4">
          <SolutionArchitect
            discoveryId={discoveryId}
            providers={activeDiscovery?.solution_providers || ["Microsoft Azure"]}
          />
        </TabsContent>
      </Tabs>
    </PhaseShell>
  );
}
