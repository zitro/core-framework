"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Search, Clock, ArrowRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useDiscovery } from "@/stores/discovery-store";
import { PHASE_CONFIG, type Discovery } from "@/types/core";

const PHASE_COLORS: Record<string, string> = {
  capture: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  orient: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  refine: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  execute: "bg-violet-500/10 text-violet-700 border-violet-500/30",
};

export default function DiscoveriesPage() {
  const { discoveries, loadDiscoveries, setActiveDiscovery, deleteDiscovery, loading } = useDiscovery();
  const [filter, setFilter] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadDiscoveries();
  }, [loadDiscoveries]);

  const filtered = discoveries
    .filter((d) =>
      d.name.toLowerCase().includes(filter.toLowerCase()) ||
      d.description.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const selectDiscovery = (d: Discovery) => {
    setActiveDiscovery(d);
    const phaseHref = `/${d.current_phase}`;
    router.push(phaseHref);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
          <FolderOpen className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Discoveries</h1>
          <p className="text-muted-foreground text-sm">Browse and resume past discovery sessions.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search discoveries..."
          className="pl-9"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading discoveries...</p>}

      {!loading && filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              {filter ? "No discoveries match your search." : "No discoveries yet. Create one from the Dashboard."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((d) => (
          <Card key={d.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => selectDiscovery(d)}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium truncate">{d.name}</h3>
                  <Badge variant="outline" className={`text-[10px] ${PHASE_COLORS[d.current_phase] || ""}`}>
                    {PHASE_CONFIG[d.current_phase]?.label || d.current_phase}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">{d.mode}</Badge>
                </div>
                {d.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{d.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(d.updated_at)}
                  </span>
                  {d.problem_statement?.statement && (
                    <span className="truncate max-w-[300px]">
                      Problem: {d.problem_statement.statement}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${d.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      `Delete discovery "${d.name}"? Evidence and analyses linked to it will become orphaned but are not deleted automatically.`,
                    )
                  ) {
                    deleteDiscovery(d.id).catch(() => {});
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
