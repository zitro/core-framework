"use client";

/**
 * AddSourceForm — collapsed-by-default form to add a new Source to a
 * customer. PAT is plaintext on the wire (over HTTPS) and encrypted
 * server-side via Fernet before persistence; only last4 returns.
 */

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SourceCreatePayload, SourceKind, SourceRole } from "@/lib/api";

interface Props {
  onAdd: (payload: SourceCreatePayload) => Promise<void>;
  kinds: { value: SourceKind; label: string }[];
  roles: { value: SourceRole; label: string }[];
}

export function AddSourceForm({ onAdd, kinds, roles }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<SourceKind>("github");
  const [role, setRole] = useState<SourceRole>("vertex");
  const [location, setLocation] = useState("");
  const [branch, setBranch] = useState("main");
  const [writable, setWritable] = useState(true);
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setLabel("");
    setKind("github");
    setRole("vertex");
    setLocation("");
    setBranch("main");
    setWritable(true);
    setPat("");
  };

  const submit = async () => {
    if (!label.trim() || !location.trim()) return;
    setBusy(true);
    try {
      await onAdd({ label, kind, role, location, branch, writable, pat: pat || undefined });
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add source
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Allstate vertex"
          />
        </Field>
        <Field label="Kind">
          <NativeSelect value={kind} onChange={(v) => setKind(v as SourceKind)} options={kinds} />
        </Field>
        <Field label="Role">
          <NativeSelect value={role} onChange={(v) => setRole(v as SourceRole)} options={roles} />
        </Field>
        <Field label={kind === "github" ? "owner/repo" : "Path"}>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={kind === "github" ? "mcaps-microsoft/allstate" : "/data/allstate"}
          />
        </Field>
        {kind === "github" && (
          <>
            <Field label="Branch">
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
            </Field>
            <Field label="PAT (optional)">
              <Input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_…"
                autoComplete="off"
              />
            </Field>
          </>
        )}
        <label className="col-span-full flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={writable}
            onChange={(e) => setWritable(e.target.checked)}
            aria-label="Writable"
          />
          Writable (push artifacts here)
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy || !label.trim() || !location.trim()}>
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Add source
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
