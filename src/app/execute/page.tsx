"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PHASE_CONFIG } from "@/types/core";
import type { QuickWin, Blocker, ExecuteData } from "@/types/core";
import { useDiscovery } from "@/stores/discovery-store";
import { api } from "@/lib/api";
import { QuickWinTracker } from "@/components/execute/quick-win-tracker";
import { BlockerList } from "@/components/execute/blocker-list";
import { HandoffPanel } from "@/components/execute/handoff-panel";

const config = PHASE_CONFIG.execute;

export default function ExecutePage() {
  const { activeDiscovery } = useDiscovery();

  const [wins, setWins] = useState<QuickWin[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [handoffNotes, setHandoffNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const data = activeDiscovery?.execute_data;
    if (data) {
      setWins(data.quick_wins ?? []);
      setBlockers(data.blockers ?? []);
      setHandoffNotes(data.handoff_notes ?? "");
    }
  }, [activeDiscovery?.id, activeDiscovery?.execute_data]);

  const persistExecuteData = useCallback(
    async (data: ExecuteData) => {
      const id = activeDiscovery?.id;
      if (!id) return;
      setSaving(true);
      try {
        await api.discoveries.update(id, { execute_data: data } as Partial<import("@/types/core").Discovery>);
      } catch {
        // silent — data is in local state anyway
      } finally {
        setSaving(false);
      }
    },
    [activeDiscovery?.id]
  );

  const addWin = (win: Omit<QuickWin, "id" | "done">) => {
    const newWin: QuickWin = { ...win, id: crypto.randomUUID(), done: false };
    const updated = [...wins, newWin];
    setWins(updated);
    persistExecuteData({ quick_wins: updated, blockers, handoff_notes: handoffNotes });
  };

  const toggleWin = (id: string) => {
    const updated = wins.map((w) => (w.id === id ? { ...w, done: !w.done } : w));
    setWins(updated);
    persistExecuteData({ quick_wins: updated, blockers, handoff_notes: handoffNotes });
  };

  const addBlocker = (blocker: Omit<Blocker, "id" | "resolved">) => {
    const newBlocker: Blocker = { ...blocker, id: crypto.randomUUID(), resolved: false };
    const updated = [...blockers, newBlocker];
    setBlockers(updated);
    persistExecuteData({ quick_wins: wins, blockers: updated, handoff_notes: handoffNotes });
  };

  const toggleBlocker = (id: string) => {
    const updated = blockers.map((b) => (b.id === id ? { ...b, resolved: !b.resolved } : b));
    setBlockers(updated);
    persistExecuteData({ quick_wins: wins, blockers: updated, handoff_notes: handoffNotes });
  };

  const saveHandoffNotes = () => {
    persistExecuteData({ quick_wins: wins, blockers, handoff_notes: handoffNotes });
  };

  const completedWins = wins.filter((w) => w.done).length;
  const resolvedBlockers = blockers.filter((b) => b.resolved).length;
  const hasCriticalBlockers = blockers.some((b) => !b.resolved && b.severity === "critical");
  const validatedAssumptions = (activeDiscovery?.assumptions ?? []).filter((a) => a.status === "validated");

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <Rocket className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Select or create a discovery from the Dashboard to start executing.</p>
      </div>
    );
  }

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
            <p className="text-2xl font-bold">{wins.length > 0 && !hasCriticalBlockers ? "Ready" : "Not Yet"}</p>
            <p className="text-xs text-muted-foreground">Handoff Status</p>
          </CardContent>
        </Card>
      </div>

      {(activeDiscovery?.problem_statement?.statement || validatedAssumptions.length > 0) && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-4 space-y-2">
            {activeDiscovery?.problem_statement?.statement && (
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-600 font-medium">Problem Statement</p>
                <p className="text-sm mt-1">{activeDiscovery.problem_statement.statement}</p>
              </div>
            )}
            {validatedAssumptions.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-600 font-medium mt-2">
                  Validated Assumptions ({validatedAssumptions.length})
                </p>
                <ul className="text-sm mt-1 space-y-1">
                  {validatedAssumptions.map((a) => (
                    <li key={a.id} className="text-xs text-muted-foreground">• {a.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          <QuickWinTracker wins={wins} onAdd={addWin} onToggle={toggleWin} />
        </TabsContent>

        <TabsContent value="blockers" className="space-y-4">
          <BlockerList blockers={blockers} onAdd={addBlocker} onToggle={toggleBlocker} />
        </TabsContent>

        <TabsContent value="handoff" className="space-y-4">
          <HandoffPanel
            wins={wins}
            blockers={blockers}
            handoffNotes={handoffNotes}
            onNotesChange={setHandoffNotes}
            onSave={saveHandoffNotes}
            saving={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
