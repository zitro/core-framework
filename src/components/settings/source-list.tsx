"use client";

/**
 * SourceList — rows of sources for one Customer with sync / delete and
 * a collapsed Add form. Heavy add-form is in <AddSourceForm>.
 */

import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  GitBranch,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  api,
  type CustomerRecord,
  type SourceCreatePayload,
  type SourceKind,
  type SourceRecord,
  type SourceRole,
} from "@/lib/api";
import { AddSourceForm } from "@/components/settings/add-source-form";

interface Props {
  customer: CustomerRecord;
  onChange: (next: CustomerRecord) => void;
}

const KINDS: { value: SourceKind; label: string }[] = [
  { value: "github", label: "GitHub repo" },
  { value: "local", label: "Local clone" },
  { value: "folder", label: "Plain folder" },
];

const ROLES: { value: SourceRole; label: string }[] = [
  { value: "vertex", label: "Vertex" },
  { value: "core", label: "Core overlay" },
  { value: "notes", label: "Notes" },
  { value: "reference", label: "Reference" },
];

export function SourceList({ customer, onChange }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const sync = async (id: string) => {
    setBusyId(id);
    try {
      const res = await api.customers.syncSource(customer.id, id);
      const sources = customer.sources.map((s) =>
        s.id === id
          ? { ...s, last_sync_status: res.status, last_synced_at: res.last_synced_at }
          : s,
      );
      onChange({ ...customer, sources });
      if (res.status.startsWith("error")) toast.error(res.status);
      else toast.success(`Synced ${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this source from the customer?")) return;
    setBusyId(id);
    try {
      await api.customers.deleteSource(customer.id, id);
      onChange({ ...customer, sources: customer.sources.filter((s) => s.id !== id) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const add = async (payload: SourceCreatePayload) => {
    const created = await api.customers.addSource(customer.id, payload);
    onChange({ ...customer, sources: [...customer.sources, created] });
  };

  return (
    <div className="space-y-3">
      {customer.sources.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No sources yet — add the first below.
        </p>
      ) : (
        <ul className="space-y-2">
          {customer.sources.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              busy={busyId === s.id}
              onSync={() => sync(s.id)}
              onRemove={() => remove(s.id)}
            />
          ))}
        </ul>
      )}
      <AddSourceForm onAdd={add} kinds={KINDS} roles={ROLES} />
    </div>
  );
}

function SourceRow({
  source,
  busy,
  onSync,
  onRemove,
}: {
  source: SourceRecord;
  busy: boolean;
  onSync: () => void;
  onRemove: () => void;
}) {
  const KindIcon = source.kind === "github" ? GitBranch : HardDrive;
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <KindIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">{source.label}</span>
          <Badge variant="outline" className="text-[10px] uppercase">{source.role}</Badge>
          {source.writable && (
            <Badge variant="secondary" className="text-[10px] uppercase">writable</Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {source.location}
          {source.kind === "github" && source.branch && ` Â· ${source.branch}`}
          {source.pat_last4 && <> · PAT …{source.pat_last4}</>}
        </p>
        <SyncStatus status={source.last_sync_status} when={source.last_synced_at} />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSync}
          disabled={busy}
          title="Sync now"
          aria-label="Sync now"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={busy}
          aria-label="Remove source"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function SyncStatus({ status, when }: { status: string; when: string | null }) {
  if (!status) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> Not synced yet
      </p>
    );
  }
  const isError = status.startsWith("error");
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <p
      className={`flex items-center gap-1 text-[11px] ${
        isError ? "text-rose-600" : "text-emerald-600"
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="truncate">{status}</span>
      {when && (
        <span className="text-muted-foreground"> Â· {new Date(when).toLocaleString()}</span>
      )}
    </p>
  );
}
