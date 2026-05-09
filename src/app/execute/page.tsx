"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import type { QuickWin, Blocker, ExecuteData } from "@/types/core";
import { useDiscovery } from "@/stores/discovery-store";
import { api } from "@/lib/api";
import { OutputCommandCenter } from "@/components/execute/output-command-center";
import { PhaseShell } from "@/components/layout/phase-shell";

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

  if (!activeDiscovery) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <Rocket className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Select or create a discovery from the Dashboard to start executing.</p>
      </div>
    );
  }

  return (
    <PhaseShell
      phase="execute"
      discoveryId={activeDiscovery.id}
      showEvidencePanel={false}
      showDtMethodsPanel={false}
    >
      <OutputCommandCenter
        discovery={activeDiscovery}
        wins={wins}
        blockers={blockers}
        handoffNotes={handoffNotes}
        saving={saving}
        onAddWin={addWin}
        onToggleWin={toggleWin}
        onAddBlocker={addBlocker}
        onToggleBlocker={toggleBlocker}
        onHandoffNotesChange={setHandoffNotes}
        onSaveHandoffNotes={saveHandoffNotes}
      />
    </PhaseShell>
  );
}
