"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { engagementsApi } from "@/lib/api-fde";
import { EngagementDiscoveriesPanel } from "@/components/engagements/engagement-discoveries-panel";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ENGAGEMENT_STATUS_LABELS,
  type Engagement,
  type EngagementStatus,
} from "@/types/fde";

const STATUSES: EngagementStatus[] = [
  "proposed",
  "active",
  "paused",
  "completed",
  "cancelled",
];

export default function EngagementsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Engagement[]>([]);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [industry, setIndustry] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () =>
    engagementsApi.list().then(setItems).catch(() => {});

  useEffect(() => {
    reload();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      await engagementsApi.create({ name, customer, industry, summary });
      setName("");
      setCustomer("");
      setIndustry("");
      setSummary("");
      await reload();
      toast.success("Engagement created");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: EngagementStatus) => {
    await engagementsApi.update(id, { status });
    await reload();
  };

  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const remove = (id: string) => {
    setRemoveTarget(id);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await engagementsApi.delete(removeTarget);
    setRemoveTarget(null);
    await reload();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Engagements"
        description="Group discoveries under a customer engagement."
        icon={Briefcase}
        accent="brand"
      />


      <Card>
        <CardHeader>
          <CardTitle className="text-base">New engagement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
            <Input
              placeholder="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Short summary…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
          />
          <Button size="sm" onClick={create} disabled={busy}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No engagements yet"
            description="Create one above to group discoveries under a customer engagement, or start a new project from the dashboard."
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("core:start-new-discovery"));
                  }
                  router.push("/?newDiscovery=1");
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                Start a new project
              </Button>
            }
          />
        ) : (
          items.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{e.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {ENGAGEMENT_STATUS_LABELS[e.status]}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {e.customer && <span>Customer: {e.customer}</span>}
                  {e.industry && <span>· Industry: {e.industry}</span>}
                  <span>· {e.discovery_ids.length} discoveries</span>
                </div>
                {e.summary && <p>{e.summary}</p>}
                <EngagementDiscoveriesPanel
                  engagement={e}
                  onChanged={(next) =>
                    setItems((curr) => curr.map((x) => (x.id === next.id ? next : x)))
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={e.status === s ? "default" : "outline"}
                      onClick={() => setStatus(e.id, s)}
                    >
                      {ENGAGEMENT_STATUS_LABELS[s]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Delete engagement?"
        description="This permanently removes the engagement and unlinks its discoveries. The discoveries themselves are kept."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmRemove}
      />
    </div>
  );
}
