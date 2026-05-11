"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { engagementsApi } from "@/lib/api-fde";
import { useDiscovery } from "@/stores/discovery-store";
import type { Discovery } from "@/types/core";
import type { Engagement } from "@/types/fde";
import { toast } from "sonner";

interface Props {
  engagement: Engagement;
  onChanged: (next: Engagement) => void;
}

export function EngagementDiscoveriesPanel({ engagement, onChanged }: Props) {
  const router = useRouter();
  const { setActiveDiscovery } = useDiscovery();
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openDiscovery = (d: Discovery) => {
    setActiveDiscovery(d);
    router.push(`/${d.current_phase}`);
  };

  useEffect(() => {
    api.discoveries.list().then(setDiscoveries).catch(() => {});
  }, []);

  const attached = useMemo(
    () => discoveries.filter((d) => engagement.discovery_ids.includes(d.id)),
    [discoveries, engagement.discovery_ids],
  );
  const candidates = useMemo(
    () => discoveries.filter((d) => !engagement.discovery_ids.includes(d.id)),
    [discoveries, engagement.discovery_ids],
  );

  const attach = async (discoveryId: string) => {
    setBusyId(discoveryId);
    try {
      const next = await engagementsApi.attachDiscovery(engagement.id, discoveryId);
      onChanged(next);
      toast.success("Attached");
      setPickerOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  const detach = async (discoveryId: string) => {
    setBusyId(discoveryId);
    try {
      const next = await engagementsApi.detachDiscovery(engagement.id, discoveryId);
      onChanged(next);
      toast.success("Detached");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Attached discoveries ({attached.length})
        </h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={candidates.length === 0}
        >
          <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
          Attach
        </Button>
      </div>

      {attached.length === 0 ? (
        <p className="text-xs text-muted-foreground">No discoveries attached yet.</p>
      ) : (
        <ul className="space-y-1">
          {attached.map((d) => (
            <li
              key={d.id}
              className="group flex items-center justify-between gap-2 rounded border bg-muted/30 px-2.5 py-1.5 transition-colors hover:border-brand/40 hover:bg-muted/50"
            >
              <button
                type="button"
                onClick={() => openDiscovery(d)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
              >
                <Badge variant="outline" className="text-[10px] capitalize">
                  {d.current_phase}
                </Badge>
                <span className="truncate text-sm group-hover:text-brand">{d.name}</span>
                <ArrowRight className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  void detach(d.id);
                }}
                disabled={busyId === d.id}
                aria-label="Detach discovery"
              >
                {busyId === d.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {pickerOpen && candidates.length > 0 && (
        <div className="rounded border bg-background p-2 space-y-1">
          {candidates.map((d) => (
            <button
              key={d.id}
              type="button"
              className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              disabled={busyId === d.id}
              onClick={() => attach(d.id)}
            >
              <span className="text-muted-foreground text-xs mr-2">{d.current_phase}</span>
              {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
