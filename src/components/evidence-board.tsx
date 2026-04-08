"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Evidence, CorePhase, ConfidenceLevel } from "@/types/core";
import { api } from "@/lib/api";
import { useDiscovery } from "@/stores/discovery-store";

const PHASE_COLORS: Record<CorePhase, string> = {
  capture: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  orient: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  refine: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  execute: "bg-violet-500/10 text-violet-700 border-violet-500/30",
};

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  validated: "bg-emerald-500/10 text-emerald-700",
  assumed: "bg-amber-500/10 text-amber-700",
  unknown: "bg-zinc-500/10 text-zinc-600",
  conflicting: "bg-red-500/10 text-red-700",
};

export function EvidenceBoard() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id;

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [phase, setPhase] = useState<CorePhase>("capture");
  const [confidence, setConfidence] = useState<ConfidenceLevel>("unknown");
  const [tags, setTags] = useState("");
  const [adding, setAdding] = useState(false);

  // Filter state
  const [filterPhase, setFilterPhase] = useState<CorePhase | "all">("all");

  const loadEvidence = useCallback(async () => {
    if (!discoveryId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await api.evidence.list(discoveryId);
      setEvidence(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [discoveryId]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const addEvidence = async () => {
    if (!content.trim() || !discoveryId) return;
    setAdding(true);
    try {
      const item = await api.evidence.create({
        discovery_id: discoveryId,
        phase,
        content,
        source,
        confidence,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEvidence((prev) => [...prev, item]);
      setContent("");
      setSource("");
      setTags("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add evidence");
    } finally {
      setAdding(false);
    }
  };

  const deleteEvidence = async (id: string) => {
    try {
      await api.evidence.delete(id);
      setEvidence((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // silent
    }
  };

  const filtered =
    filterPhase === "all"
      ? evidence
      : evidence.filter((e) => e.phase === filterPhase);

  if (!discoveryId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">
            Select or create a discovery session to use the Evidence Board.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Add Evidence
          </CardTitle>
          <CardDescription>
            Capture observations, quotes, and data points linked to this
            discovery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What did you observe, hear, or measure?"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Source</label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g., Interview with Dr. Smith"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Tags (comma-separated)</label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., scheduling, pain-point"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Phase</label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as CorePhase)}
                className="flex h-9 w-full rounded-md border px-3 text-sm"
                title="CORE phase"
              >
                <option value="capture">Capture</option>
                <option value="orient">Orient</option>
                <option value="refine">Refine</option>
                <option value="execute">Execute</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Confidence</label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}
                className="flex h-9 w-full rounded-md border px-3 text-sm"
                title="Confidence level"
              >
                <option value="validated">Validated</option>
                <option value="assumed">Assumed</option>
                <option value="unknown">Unknown</option>
                <option value="conflicting">Conflicting</option>
              </select>
            </div>
          </div>
          <Button onClick={addEvidence} disabled={adding || !content.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {adding ? "Adding..." : "Add Evidence"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Filter:</span>
        {(["all", "capture", "orient", "refine", "execute"] as const).map(
          (p) => (
            <Button
              key={p}
              size="sm"
              variant={filterPhase === p ? "default" : "outline"}
              onClick={() => setFilterPhase(p)}
              className="text-xs"
            >
              {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          )
        )}
        <Badge variant="secondary" className="ml-auto">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading evidence...</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No evidence captured yet. Add observations from your discovery sessions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {filtered.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.content}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge
                          variant="outline"
                          className={`border-0 text-[10px] ${PHASE_COLORS[item.phase]}`}
                        >
                          {item.phase}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`border-0 text-[10px] ${CONFIDENCE_COLORS[item.confidence]}`}
                        >
                          {item.confidence}
                        </Badge>
                        {item.source && (
                          <span className="text-[10px] text-muted-foreground">
                            via {item.source}
                          </span>
                        )}
                        {item.tags?.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                      onClick={() => deleteEvidence(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
