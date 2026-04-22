"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { engagementsApi } from "@/lib/api-fde";
import type { Engagement } from "@/types/fde";
import { toast } from "sonner";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Engagement) => void | Promise<void>;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [industry, setIndustry] = useState("");
  const [summary, setSummary] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setCustomer("");
    setIndustry("");
    setSummary("");
    setRepoPath("");
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      const created = await engagementsApi.create({
        name: name.trim(),
        customer: customer.trim(),
        industry: industry.trim(),
        summary: summary.trim(),
        repo_path: repoPath.trim(),
      });
      toast.success(`Project "${created.name}" created`);
      reset();
      onOpenChange(false);
      await onCreated?.(created);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project groups all discoveries, evidence, and outputs for one
            customer engagement.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3 pt-1"
        >
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Allstate · 24-hour Data to Insights"
              autoFocus
              disabled={busy}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Customer">
              <Input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Allstate"
                disabled={busy}
              />
            </Field>
            <Field label="Industry">
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Insurance"
                disabled={busy}
              />
            </Field>
          </div>
          <Field label="Summary">
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What is this engagement about?"
              rows={3}
              className="max-h-40 resize-y"
              disabled={busy}
            />
          </Field>
          <Field
            label="Engagement repo path"
            hint="Optional. Path to a cloned engagement repo for note ingestion."
          >
            <Input
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/path/to/engagement-repo"
              disabled={busy}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create project"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, hint, required, children }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </label>
  );
}
