"use client";

import { useEffect, useState } from "react";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { engagementsApi } from "@/lib/api-fde";
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

  const remove = async (id: string) => {
    if (!confirm("Delete this engagement?")) return;
    await engagementsApi.delete(id);
    await reload();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
          <Briefcase className="h-5 w-5 text-sky-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Engagements</h1>
          <p className="text-muted-foreground text-sm">
            Group discoveries under a customer engagement.
          </p>
        </div>
      </div>

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
          <p className="text-sm text-muted-foreground">No engagements yet.</p>
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
    </div>
  );
}
