"use client";

import { useState } from "react";
import Link from "next/link";
import { BookMarked, ExternalLink, Lightbulb, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import {
  methodsForPhase,
  PHASE_TO_DT_STAGE,
  type CorePhase,
} from "@/lib/dt-methods";

const DT_PROMPT: Record<CorePhase, string> = {
  capture: "What are you observing, hearing, or sensing that might matter? Note surprises, contradictions, or patterns before you start analysing.",
  orchestrate: "What tensions or themes are surfacing across the evidence? Draft a 'How Might We…' statement or name a key assumption you want to challenge.",
  refine: "What constraints or risks have changed your view of the solution space? Capture any new assumptions or reframes that emerged from testing.",
  execute: "What did you learn from delivering this phase? Note what to carry forward, what to discard, and what surprised you.",
};

interface DtMethodsPanelProps {
  phase: CorePhase;
  discoveryId?: string;
}

/**
 * Per-phase nudge: which design-thinking methods to reach for here, and
 * which ones ship as templates the team can drop into their engagement repo.
 * Includes a free-form input so practitioners can capture DT observations inline.
 */
export function DtMethodsPanel({ phase, discoveryId }: DtMethodsPanelProps) {
  const methods = methodsForPhase(phase);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveNote = async () => {
    if (!note.trim() || !discoveryId) return;
    setSaving(true);
    try {
      await api.evidence.create({
        discovery_id: discoveryId,
        phase,
        content: note.trim(),
        source: `Design thinking — ${PHASE_TO_DT_STAGE[phase]}`,
        confidence: "assumed",
        tags: ["design-thinking"],
      });
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  if (methods.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-amber-500" />
            Design thinking — {PHASE_TO_DT_STAGE[phase]}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User input area */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">{DT_PROMPT[phase]}</p>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Capture a thought, observation, 'How Might We…', or assumption…"
            rows={3}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={saveNote}
              disabled={saving || !note.trim() || !discoveryId}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Saving…" : saved ? "Saved!" : "Save as Evidence"}
            </Button>
          </div>
        </div>

        {/* Methodology */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Methodology
            </p>
            <Link
              href="/methodology"
              className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
            >
              View all
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {methods.map((m) => (
              <div key={m.id} className="border-l-2 pl-3 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold">{m.name}</h4>
                  {m.template && (
                    <Badge variant="outline" className="text-[9px]">
                      template
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{m.oneLiner}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
