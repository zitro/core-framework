"use client";

/**
 * CustomerPanel — list customers, create new, edit, delete; embedded
 * SourceList per selected customer.
 *
 * Loads on mount; sidebar selects a customer, main area shows headline
 * fields + source rows. PATs are stored encrypted server-side; only the
 * last 4 chars surface here.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, type CustomerRecord } from "@/lib/api";
import { SourceList } from "@/components/settings/source-list";

export function CustomerPanel() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const active = useMemo(
    () => customers.find((c) => c.id === activeId) ?? null,
    [customers, activeId],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const list = await api.customers.list();
        if (cancelled) return;
        setCustomers(list);
        setActiveId(list[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load customers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const c = await api.customers.create({ display_name: newName.trim() });
      setCustomers((prev) => [...prev, c]);
      setActiveId(c.id);
      setNewName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const updateActive = async (data: Partial<CustomerRecord>) => {
    if (!active) return;
    try {
      const next = await api.customers.update(active.id, {
        display_name: data.display_name,
        slug: data.slug,
        industry: data.industry,
        summary: data.summary,
      });
      setCustomers((prev) => prev.map((c) => (c.id === active.id ? next : c)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const remove = async () => {
    if (!active) return;
    if (!confirm(`Delete customer "${active.display_name}"? This cannot be undone.`)) return;
    try {
      await api.customers.delete(active.id);
      const remaining = customers.filter((c) => c.id !== active.id);
      setCustomers(remaining);
      setActiveId(remaining[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Customers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : customers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No customers yet.</p>
            ) : (
              <ul className="space-y-1">
                {customers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      aria-pressed={c.id === activeId}
                      className={
                        "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition " +
                        (c.id === activeId
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent")
                      }
                    >
                      <span className="truncate">{c.display_name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {c.sources.length}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void create();
                  }
                }}
                placeholder="New customer name"
                aria-label="New customer name"
              />
              <Button size="icon" onClick={create} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      <section>
        {active ? (
          <CustomerEditor
            key={active.id}
            customer={active}
            onSave={updateActive}
            onDelete={remove}
            onSourcesChanged={(next) =>
              setCustomers((prev) => prev.map((c) => (c.id === next.id ? next : c)))
            }
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Select a customer or create a new one.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function CustomerEditor({
  customer,
  onSave,
  onDelete,
  onSourcesChanged,
}: {
  customer: CustomerRecord;
  onSave: (data: Partial<CustomerRecord>) => Promise<void>;
  onDelete: () => Promise<void>;
  onSourcesChanged: (next: CustomerRecord) => void;
}) {
  const [draft, setDraft] = useState({
    display_name: customer.display_name,
    slug: customer.slug,
    industry: customer.industry,
    summary: customer.summary,
  });

  const dirty =
    draft.display_name !== customer.display_name ||
    draft.slug !== customer.slug ||
    draft.industry !== customer.industry ||
    draft.summary !== customer.summary;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Customer details</CardTitle>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> Delete
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Display name">
            <Input
              value={draft.display_name}
              onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
            />
          </Field>
          <Field label="Slug">
            <Input
              value={draft.slug}
              onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
            />
          </Field>
          <Field label="Industry">
            <Input
              value={draft.industry}
              onChange={(e) => setDraft((d) => ({ ...d, industry: e.target.value }))}
            />
          </Field>
          <Field label="Summary" className="md:col-span-2">
            <Textarea
              rows={2}
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" onClick={() => onSave(draft)} disabled={!dirty}>
              Save details
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <SourceList customer={customer} onChange={onSourcesChanged} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium ${className ?? ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
