"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Assumption,
  ContextBriefVersion,
  Discovery,
  RefineAgentDefinition,
  RefineReview,
  UseCaseVersion,
} from "@/types/core";
import { api } from "@/lib/api";
import { RefineAgentChat } from "@/components/refine/refine-agent-chat";
import { OrchestrateHandoff } from "@/components/refine/expert-review-handoff";
import { ExpertPanel } from "@/components/refine/expert-review-panel";
import { ReviewSynthesis } from "@/components/refine/expert-review-synthesis";
import { AgentOpinions } from "@/components/refine/expert-review-agent-opinions";
import { Roundtable } from "@/components/refine/expert-review-roundtable";
import {
  SurfacedAssumptions,
  type SurfacedAssumption,
} from "@/components/refine/expert-review-surfaced-assumptions";

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

  const surfacedAssumptions = useMemo<SurfacedAssumption[]>(() => {
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

  return (
    <div className="space-y-4">
      <OrchestrateHandoff
        activeDiscovery={activeDiscovery}
        assumptions={assumptions}
        latestBrief={latestBrief}
        latestUseCase={latestUseCase}
        latestReview={latestReview}
      />

      <ExpertPanel
        agents={agents}
        selectedAgentIds={selectedAgentIds}
        runningAgentIds={runningAgentIds}
        instructions={instructions}
        error={error}
        onInstructionsChange={setInstructions}
        onToggleAgent={toggleAgent}
        onRunReview={runReview}
      />

      {latestReview && (
        <>
          <ReviewSynthesis review={latestReview} />
          <AgentOpinions opinions={latestReview.opinions} />
          <Roundtable review={latestReview} />
          <RefineAgentChat discoveryId={discoveryId} agents={agents} onReviewVersionCreated={() => void loadData()} />
          {surfacedAssumptions.length > 0 && (
            <SurfacedAssumptions items={surfacedAssumptions} onAdd={addSurfacedAssumptions} />
          )}
        </>
      )}
    </div>
  );
}
