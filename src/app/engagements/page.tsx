"use client";

/**
 * /engagements — grouped by Customer → Engagement → Discovery.
 *
 * Purpose: the single nav entry point for finding work. Customers cluster
 * at the top level (most teams work with a small number); each customer's
 * engagements stack underneath; each engagement's attached discoveries
 * are clickable and load straight into their current phase.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { EngagementDiscoveriesPanel } from "@/components/engagements/engagement-discoveries-panel";
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

const UNSPECIFIED_CUSTOMER = "Unspecified";

export default function EngagementsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Engagement[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [industry, setIndustry] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const reload = () => engagementsApi.list().then(setItems).catch(() => {});

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
      setCreatorOpen(false);
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

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await engagementsApi.delete(removeTarget);
    setRemoveTarget(null);
    await reload();
  };

  // Group by customer, alphabetical with Unspecified last.
  const groupedByCustomer = useMemo(() => {
    const groups = new Map<string, Engagement[]>();
    for (const e of items) {
      const key = e.customer?.trim() || UNSPECIFIED_CUSTOMER;
      const bucket = groups.get(key);
      if (bucket) bucket.push(e);
      else groups.set(key, [e]);
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      if (a === UNSPECIFIED_CUSTOMER) return 1;
      if (b === UNSPECIFIED_CUSTOMER) return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [items]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        title="Engagements"
        description="Customers → engagements → discoveries. Click a discovery to load it."
        icon={Briefcase}
        accent="brand"
        actions={
          <Button size="sm" onClick={() => setCreatorOpen((v) => !v)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New engagement
          </Button>
        }
      />

      {creatorOpen && (
        <section className="space-y-3 rounded-md border bg-card p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            New engagement
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
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
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreatorOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void create()} disabled={busy}>
              Create
            </Button>
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No engagements yet"
          description="Create one to group discoveries under a customer, or start a new project from the dashboard."
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
        <div className="space-y-6">
          {groupedByCustomer.map(([customer, engagements]) => {
            const totalDiscoveries = engagements.reduce(
              (acc, e) => acc + (e.discovery_ids?.length ?? 0),
              0,
            );
            return (
              <section key={customer} className="space-y-3">
                <header className="flex items-baseline gap-2 border-b pb-1.5">
                  <h2 className="font-heading text-base font-semibold tracking-tight">
                    {customer}
                  </h2>
                  <span className="text-[11px] text-muted-foreground">
                    {engagements.length} engagement{engagements.length === 1 ? "" : "s"} ·{" "}
                    {totalDiscoveries} discover{totalDiscoveries === 1 ? "y" : "ies"}
                  </span>
                </header>

                <div className="space-y-2.5 pl-3">
                  {engagements.map((e) => (
                    <EngagementCard
                      key={e.id}
                      engagement={e}
                      onChanged={(next) =>
                        setItems((curr) => curr.map((x) => (x.id === next.id ? next : x)))
                      }
                      onSetStatus={setStatus}
                      onRemove={() => setRemoveTarget(e.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

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

interface EngagementCardProps {
  engagement: Engagement;
  onChanged: (next: Engagement) => void;
  onSetStatus: (id: string, status: EngagementStatus) => void;
  onRemove: () => void;
}

function EngagementCard({
  engagement,
  onChanged,
  onSetStatus,
  onRemove,
}: EngagementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const discoveryCount = engagement.discovery_ids?.length ?? 0;

  return (
    <article className="rounded-md border bg-card transition-colors hover:border-brand/30">
      <header className="flex items-start justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left"
          aria-expanded={expanded}
        >
          <ChevronRight
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-medium">{engagement.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {ENGAGEMENT_STATUS_LABELS[engagement.status]}
              </Badge>
              {engagement.industry && <span>{engagement.industry}</span>}
              <span>·</span>
              <span>
                {discoveryCount} discover{discoveryCount === 1 ? "y" : "ies"}
              </span>
            </div>
          </div>
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={onRemove}
          aria-label="Delete engagement"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </header>

      {expanded && (
        <div className="space-y-3 border-t bg-muted/20 px-4 py-3 text-sm">
          {engagement.summary && (
            <p className="text-xs leading-relaxed text-muted-foreground">{engagement.summary}</p>
          )}
          <EngagementDiscoveriesPanel engagement={engagement} onChanged={onChanged} />
          <div className="flex flex-wrap gap-1.5 border-t pt-3">
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={engagement.status === s ? "default" : "outline"}
                onClick={() => onSetStatus(engagement.id, s)}
                className="h-7 text-[11px]"
              >
                {ENGAGEMENT_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
