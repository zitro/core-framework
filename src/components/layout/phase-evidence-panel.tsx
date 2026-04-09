"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Evidence, CorePhase, ConfidenceLevel } from "@/types/core";
import { api } from "@/lib/api";

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  validated: "bg-emerald-500/10 text-emerald-700",
  assumed: "bg-amber-500/10 text-amber-700",
  unknown: "bg-zinc-500/10 text-zinc-600",
  conflicting: "bg-red-500/10 text-red-700",
};

interface PhaseEvidencePanelProps {
  discoveryId: string;
  phase: CorePhase;
}

export function PhaseEvidencePanel({ discoveryId, phase }: PhaseEvidencePanelProps) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const items = await api.evidence.list(discoveryId, phase);
      setEvidence(items);
    } catch { /* non-critical */ }
  }, [discoveryId, phase]);

  useEffect(() => { load(); }, [load]);

  const addEvidence = async () => {
    if (!content.trim()) return;
    setAdding(true);
    try {
      const item = await api.evidence.create({
        discovery_id: discoveryId,
        phase,
        content,
        source,
        confidence: "unknown" as ConfidenceLevel,
        tags: [],
      });
      setEvidence((prev) => [...prev, item]);
      setContent("");
      setSource("");
      setShowForm(false);
    } catch { /* silent */ }
    finally { setAdding(false); }
  };

  const remove = async (id: string) => {
    try {
      await api.evidence.delete(id);
      setEvidence((prev) => prev.filter((e) => e.id !== id));
    } catch { /* silent */ }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 px-4">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            Evidence
            <Badge variant="secondary" className="text-[10px]">{evidence.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 px-4 pb-3 space-y-2">
          {evidence.length === 0 && !showForm && (
            <p className="text-xs text-muted-foreground">
              No evidence for this phase yet.
            </p>
          )}
          {evidence.map((item) => (
            <div key={item.id} className="flex items-start gap-2 p-2 rounded border text-xs group">
              <Badge variant="outline" className={`border-0 text-[9px] shrink-0 ${CONFIDENCE_COLORS[item.confidence]}`}>
                {item.confidence}
              </Badge>
              <span className="flex-1">{item.content}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                onClick={() => remove(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {showForm ? (
            <div className="space-y-2 pt-1">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What did you observe?"
                rows={2}
                className="text-xs"
              />
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Source (optional)"
                className="text-xs h-7"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addEvidence} disabled={adding || !content.trim()} className="text-xs h-7">
                  {adding ? "Adding..." : "Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-xs h-7">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setShowForm(true)} className="text-xs h-7 w-full">
              <Plus className="h-3 w-3 mr-1" />
              Add Evidence
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
