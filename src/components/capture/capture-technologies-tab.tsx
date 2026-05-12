"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { TechnologyTarget } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";

interface Props {
  discoveryId: string;
  technologyInput: string;
  setTechnologyInput: (v: string) => void;
  technologyFocusInput: string;
  setTechnologyFocusInput: (v: string) => void;
  technologyTargets: TechnologyTarget[];
  setTechnologyTargets: (v: TechnologyTarget[]) => void;
}

export function CaptureTechnologiesTab({
  discoveryId,
  technologyInput,
  setTechnologyInput,
  technologyFocusInput,
  setTechnologyFocusInput,
  technologyTargets,
  setTechnologyTargets,
}: Props): React.ReactElement {
  const { setActiveDiscovery } = useDiscovery();
  const [savingTechnologies, setSavingTechnologies] = useState(false);

  async function persistTechnologyTargets(targets: TechnologyTarget[]): Promise<void> {
    if (!discoveryId) return;
    setSavingTechnologies(true);
    try {
      const updated = await api.discoveries.update(discoveryId, {
        target_technologies: targets,
        solution_providers: targets.map((item) => item.name),
      });
      setActiveDiscovery(updated);
    } catch {
      // keep local state optimistic; user can retry on next edit
    } finally {
      setSavingTechnologies(false);
    }
  }

  async function addTechnology(): Promise<void> {
    if (!technologyInput.trim() || !discoveryId) return;
    const name = technologyInput.trim();
    const focus = technologyFocusInput.trim();
    const exists = technologyTargets.some(
      (target) =>
        target.name.toLowerCase() === name.toLowerCase() &&
        target.focus.toLowerCase() === focus.toLowerCase(),
    );
    if (exists) {
      setTechnologyInput("");
      setTechnologyFocusInput("");
      return;
    }
    const next = [...technologyTargets, { name, focus }];
    setTechnologyTargets(next);
    setTechnologyInput("");
    setTechnologyFocusInput("");
    await persistTechnologyTargets(next);
  }

  async function removeTechnology(name: string, focus: string): Promise<void> {
    if (!discoveryId) return;
    const next = technologyTargets.filter(
      (target) => !(target.name === name && target.focus === focus),
    );
    setTechnologyTargets(next);
    await persistTechnologyTargets(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Target Technologies</CardTitle>
        <CardDescription>
          Add the technologies this customer wants to use so CORE can tailor discovery
          questions from the start.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Textarea
            value={technologyInput}
            onChange={(e) => setTechnologyInput(e.target.value)}
            placeholder="Technology, e.g., Microsoft Fabric"
            rows={1}
          />
          <Textarea
            value={technologyFocusInput}
            onChange={(e) => setTechnologyFocusInput(e.target.value)}
            placeholder="Specific focus, e.g., Ontologies"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void addTechnology();
              }
            }}
          />
          <Button
            onClick={() => {
              void addTechnology();
            }}
            disabled={savingTechnologies || !technologyInput.trim()}
            className="self-start"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {technologyTargets.length > 0 && (
          <div className="space-y-2">
            {technologyTargets.map((target) => (
              <div
                key={`${target.name}::${target.focus}`}
                className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
              >
                <Badge variant="secondary" className="px-2 py-1">
                  {target.name}
                </Badge>
                {target.focus && (
                  <Badge variant="outline" className="px-2 py-1">
                    Focus: {target.focus}
                  </Badge>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${target.name}`}
                  className="inline-flex items-center"
                  onClick={() => {
                    void removeTechnology(target.name, target.focus);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
