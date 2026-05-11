"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  GitCompareArrows,
  MessageSquareText,
  PanelTop,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import type {
  Assumption,
  ContextBriefVersion,
  Discovery,
  RefineAgentDefinition,
  RefineAgentOpinion,
  RefineReview,
  UseCaseVersion,
} from "@/types/core";
import { api } from "@/lib/api";
import { RefineAgentChat } from "@/components/refine/refine-agent-chat";

const agentIcon: Record<string, typeof Cpu> = {
  solution_architect: Cpu,
  principal_engineer: GitCompareArrows,
  technical_program_manager: ClipboardCheck,
  principal_data_scientist: Bot,
  product_strategist: PanelTop,
  security_compliance_advisor: ShieldCheck,
};

const gateLabel: Record<string, string> = {
  ready_for_execute: "Ready for Execute",
  needs_validation: "Needs validation",
  pivot: "Pivot direction",
  return_to_orchestrate: "Return to Orchestrate",
};

const roundtablePhaseLabel: Record<string, string> = {
  initial_position: "1. Initial Position",
  evidence_challenge: "2. Evidence Challenge",
  risk_and_work_items: "3. Risk and Work Items",
  alignment_and_tradeoffs: "4. Alignment and Tradeoffs",
  current_agreement: "5. Current Agreement",
};

interface ExpertReviewWorkshopProps {
  discoveryId: string;
  activeDiscovery: Discovery;
  assumptions: Assumption[];
  onAddAssumptions: (items: Assumption[]) => void;
}

export function ExpertReviewWorkshop({
  discoveryId,
  activeDiscovery,
  assumptions,
  onAddAssumptions,
}: ExpertReviewWorkshopProps) {
  const [agents, setAgents] = useState<RefineAgentDefinition[]>([]);
  const [reviews, setReviews] = useState<RefineReview[]>([]);
  const [briefs, setBriefs] = useState<ContextBriefVersion[]>([]);
  const [useCases, setUseCases] = useState<UseCaseVersion[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [runningAgentIds, setRunningAgentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const latestReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;
  const latestBrief = briefs.length > 0 ? briefs[briefs.length - 1] : null;
  const latestUseCase = useCases.length > 0 ? useCases[useCases.length - 1] : null;

  const loadData = useCallback(async () => {
    if (!discoveryId) return;
    const [agentList, reviewList, briefList, useCaseList] = await Promise.all([
      api.refine.agents(),
      api.refine.reviews(discoveryId),
      api.contextBriefs.list(discoveryId).catch(() => []),
      api.useCases.list(discoveryId).catch(() => []),
    ]);
    setAgents(agentList);
    setReviews(reviewList);
    setBriefs(briefList);
    setUseCases(useCaseList);
    if (selectedAgentIds.length === 0) {
      setSelectedAgentIds(agentList.map((agent) => agent.id));
    }

    // Auto-fire of api.refine.ensureFullReview removed: it hit the
    // LLM-backed /api/refine/reviews/auto/<id> endpoint on every mount
    // and 502'd without an LLM provider. Users click 'Run Full Board'
    // below to trigger the same flow explicitly.
  }, [discoveryId, selectedAgentIds.length]);

  useEffect(() => {
    loadData().catch((e) => setError(e instanceof Error ? e.message : "Failed to load Refine agents"));
  }, [loadData]);

  const surfacedAssumptions = useMemo(() => {
    const seen = new Set<string>();
    return (latestReview?.opinions ?? []).flatMap((opinion) =>
      opinion.assumptions
        .filter((text) => {
          const key = text.trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((text) => ({ text, source: opinion.title || opinion.role }))
    );
  }, [latestReview]);

  const addSurfacedAssumptions = () => {
    const existing = new Set(assumptions.map((item) => item.text.trim().toLowerCase()));
    const items = surfacedAssumptions
      .filter((item) => !existing.has(item.text.trim().toLowerCase()))
      .map((item): Assumption => ({
        id: crypto.randomUUID(),
        text: item.text,
        risk: "high",
        status: "untested",
        certainty: "unknown",
        evidence: `Surfaced by ${item.source}`,
        validation_method: "Define validation step in Refine",
        owner: "",
        impact_if_wrong: "Could weaken the recommendation before Execute",
      }));
    if (items.length > 0) onAddAssumptions(items);
  };

  const runReview = async (agentIds: string[]) => {
    if (agentIds.length === 0) return;
    setRunningAgentIds(agentIds);
    setError(null);
    try {
      const result = await api.refine.generateReview({
        discovery_id: discoveryId,
        agent_ids: agentIds,
        user_instructions: instructions || undefined,
      });
      setReviews((prev) => [...prev, result]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run expert review");
    } finally {
      setRunningAgentIds([]);
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const problemStatement = activeDiscovery.problem_statement?.statement || "No problem statement has been sent forward yet.";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PanelTop className="h-4 w-4 text-emerald-500" />
            Orchestrate Handoff
          </CardTitle>
          <CardDescription>
            The expert panel reviews the current understanding, problem, use case, evidence, and unresolved risks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Problem</p>
              <p className="text-sm line-clamp-5">{problemStatement}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Project Understanding</p>
              <p className="text-sm line-clamp-5">{latestBrief?.summary || activeDiscovery.description || "No project understanding has been generated yet."}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Use Case</p>
              <p className="text-sm font-medium">{latestUseCase?.title || "No use case draft yet"}</p>
              {latestUseCase && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{latestUseCase.summary}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{activeDiscovery.evidence?.length ?? 0} evidence items</Badge>
            <Badge variant="secondary">{assumptions.length} tracked assumptions</Badge>
            <Badge variant="secondary">{latestReview ? `${latestReview.opinions.length} latest agent opinions` : "No expert review yet"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            Expert Panel
          </CardTitle>
          <CardDescription>
            Run a single advisor for a focused review, or run the full board to compare expert perspectives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Optional focus for this review, such as integration risk, AI feasibility, adoption, or what must be true before Execute creates final outputs."
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runReview(selectedAgentIds)} disabled={runningAgentIds.length > 0 || selectedAgentIds.length === 0}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {runningAgentIds.length > 0 ? "Running..." : `Run Selected (${selectedAgentIds.length})`}
            </Button>
            <Button variant="outline" onClick={() => runReview(agents.map((agent) => agent.id))} disabled={runningAgentIds.length > 0 || agents.length === 0}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Run Full Board
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="grid gap-3 md:grid-cols-2">
            {agents.map((agent) => {
              const Icon = agentIcon[agent.id] ?? Bot;
              const selected = selectedAgentIds.includes(agent.id);
              const runningThis = runningAgentIds.includes(agent.id);
              return (
                <div key={agent.id} className={`rounded-lg border p-4 space-y-3 ${selected ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{agent.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{agent.mission}</p>
                      {agent.goal && <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2 line-clamp-2">Goal: {agent.goal}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.expected_outputs.slice(0, 3).map((output) => (
                      <Badge key={output} variant="outline" className="text-[10px]">{output}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant={selected ? "default" : "outline"} size="sm" onClick={() => toggleAgent(agent.id)}>
                      {selected ? "Selected" : "Select"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => runReview([agent.id])} disabled={runningAgentIds.length > 0}>
                      {runningThis ? "Running..." : "Ask Agent"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {latestReview && (
        <>
          <ReviewSynthesis review={latestReview} />
          <AgentOpinions opinions={latestReview.opinions} />
          <Roundtable review={latestReview} />
          <RefineAgentChat discoveryId={discoveryId} agents={agents} onReviewVersionCreated={() => void loadData()} />
          {surfacedAssumptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  Assumptions Surfaced by Experts
                </CardTitle>
                <CardDescription>Move these into the validation tracker when they should be tested before Execute.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {surfacedAssumptions.map((item) => (
                    <div key={`${item.source}-${item.text}`} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm">{item.text}</p>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">{item.source}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" onClick={addSurfacedAssumptions}>Add New Assumptions</Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ReviewSynthesis({ review }: { review: RefineReview }) {
  const synthesis = review.synthesis;
  return (
    <Card className="border-emerald-500/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Expert Synthesis v{review.version || 1}
            </CardTitle>
            <CardDescription>
              {new Date(review.created_at).toLocaleString()}
              {review.trigger_source && ` · ${review.trigger_source.replace("_", " ")}`}
              {review.parent_review_id && " · builds on prior version"}
            </CardDescription>
          </div>
          <Badge variant="outline">{gateLabel[synthesis.decision_gate] || synthesis.decision_gate}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Recommended Direction</p>
          <p className="text-sm whitespace-pre-line">{synthesis.recommended_direction || "No recommendation returned."}</p>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Expert confidence</span>
            <span className="font-medium">{synthesis.confidence}%</span>
          </div>
          <Progress value={synthesis.confidence} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ListBlock title="Consensus" items={synthesis.consensus} />
          <ListBlock title="Disagreements" items={synthesis.disagreements} />
        </div>
        <Separator />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Solution Options</p>
          <div className="grid gap-3 md:grid-cols-2">
            {synthesis.solution_options.map((option) => (
              <div key={option.title} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{option.title}</p>
                  <Badge variant="secondary" className="text-[10px]">{option.effort}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{option.value}</p>
                <p className="text-xs"><span className="font-medium">Risk:</span> {option.risk}</p>
                <p className="text-xs"><span className="font-medium">Evidence fit:</span> {option.evidence_fit}</p>
                {option.tradeoffs.length > 0 && <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">{option.tradeoffs.map((item) => <li key={item}>{item}</li>)}</ul>}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ListBlock title="Validation Plan" items={synthesis.validation_plan} />
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Execute Readiness</p>
            <p className="text-sm">{synthesis.execute_readiness || "No readiness note returned."}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentOpinions({ opinions }: { opinions: RefineAgentOpinion[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {opinions.map((opinion) => {
        const Icon = agentIcon[opinion.agent_id] ?? Bot;
        return (
          <Card key={`${opinion.agent_id}-${opinion.title}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4 text-emerald-500" />
                {opinion.role || opinion.agent_id}
              </CardTitle>
              <CardDescription>{opinion.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-line">{opinion.position}</p>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Role confidence</span>
                  <span className="font-medium">{opinion.confidence}%</span>
                </div>
                <Progress value={opinion.confidence} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ListBlock title="Strengths" items={opinion.strengths} />
                <ListBlock title="Concerns" items={opinion.concerns} />
                <ListBlock title="Risks" items={opinion.risks} />
                <ListBlock title="Recommendations" items={opinion.recommendations} />
              </div>
              {opinion.work_items.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Role Work Items</p>
                  <div className="space-y-2">
                    {opinion.work_items.map((item) => (
                      <div key={`${item.title}-${item.owner_role}`} className="rounded-md bg-muted/30 p-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          <Badge variant="outline" className="text-[10px]">{item.priority}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Owner: {item.owner_role || opinion.role}</p>
                        {item.rationale && <p className="mt-1 text-xs">{item.rationale}</p>}
                        {item.next_step && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Next: {item.next_step}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(opinion.artifact?.content || opinion.artifact?.bullets?.length > 0) && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium">{opinion.artifact.title || "Working artifact"}</p>
                  {opinion.artifact.content && <p className="text-sm whitespace-pre-line">{opinion.artifact.content}</p>}
                  {opinion.artifact.bullets.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {opinion.artifact.bullets.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              )}
              <ListBlock title="Questions" items={opinion.questions} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Roundtable({ review }: { review: RefineReview }) {
  if (review.roundtable.length === 0) return null;
  const phases = Object.keys(roundtablePhaseLabel);
  const grouped = phases.map((phase) => ({
    phase,
    turns: review.roundtable.filter((turn) => turn.phase === phase),
  })).filter((group) => group.turns.length > 0);
  const fallbackTurns = review.roundtable.filter((turn) => !turn.phase || !roundtablePhaseLabel[turn.phase]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-emerald-500" />
          Agent Roundtable
        </CardTitle>
        <CardDescription>Visible expert discussion, disagreement, and decision impact.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(grouped.length > 0 ? grouped : [{ phase: "discussion", turns: fallbackTurns }]).map((group) => (
          <div key={group.phase} className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {roundtablePhaseLabel[group.phase] || "Discussion"}
            </p>
            {group.turns.map((turn, index) => (
              <div key={`${turn.speaker_id}-${index}`} className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{turn.speaker}</Badge>
                  {turn.responds_to && <span className="text-xs text-muted-foreground">responding to {turn.responds_to}</span>}
                </div>
                <p className="text-sm">{turn.message}</p>
                {turn.decision_impact && <p className="text-xs text-emerald-700 dark:text-emerald-400">Decision impact: {turn.decision_impact}</p>}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">{title}</p>
      {items.length > 0 ? (
        <ul className="list-disc list-inside text-sm space-y-1">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      )}
    </div>
  );
}
