"use client";

/**
 * TemplateModal — create or edit one instance of a methodology template
 * (Empathy Map · Ops manager, Persona · Pricing analyst, …).
 *
 * If an existing artifact is passed, the modal edits it in place; if
 * none, it creates a new instance. Either way the result feeds the
 * shared ``methodology_artifacts`` store, which is what every LLM
 * synthesis prompt reads.
 */

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getTemplateFields,
  type DtMethod,
  type FdeMethod,
} from "@/lib/dt-methods";
import { methodologyApi, type MethodologyArtifact } from "@/lib/api-methodology";

type Method = (DtMethod | FdeMethod) & { template?: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: Method | null;
  discoveryId: string | undefined;
  existing?: MethodologyArtifact | null;
  onSaved?: () => void;
}

export function TemplateModal({
  open,
  onOpenChange,
  method,
  discoveryId,
  existing,
  onSaved,
}: Props) {
  const templateId = method?.template;
  const fields = templateId ? getTemplateFields(templateId) : [];

  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (existing) {
      setTitle(existing.title || "");
      setValues(existing.fields || {});
    } else {
      setTitle("");
      setValues({});
    }
  }, [open, existing]);

  const canSave =
    Boolean(discoveryId && templateId) &&
    (title.trim().length > 0 || Object.values(values).some((v) => (v || "").trim()));

  const handleSave = async () => {
    if (!templateId || !discoveryId) return;
    setSaving(true);
    setError(null);
    try {
      if (existing) {
        await methodologyApi.update(existing.id, { title, fields: values });
      } else {
        await methodologyApi.create({
          discovery_id: discoveryId,
          method_id: templateId,
          title,
          fields: values,
          source: "user",
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save instance");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      await methodologyApi.remove(existing.id);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  if (!method || !templateId) return null;

  const isAuto = existing?.source === "auto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Template
            {existing && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                Editing
              </span>
            )}
            {isAuto && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                Auto-generated
              </span>
            )}
          </div>
          <DialogTitle className="font-heading text-xl">{method.name}</DialogTitle>
          <DialogDescription>
            {method.oneLiner}
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Each instance you save feeds into every CORE synthesis prompt — what you capture here
              directly shapes problem framing, use cases, narrative, and the rest.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="tpl-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 'Ops manager' or 'Pricing analyst'"
            />
            <p className="text-[11px] text-muted-foreground">
              A short label so the team (and the LLM) can tell this instance apart.
            </p>
          </div>

          {fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <label htmlFor={`tpl-${f.id}`} className="text-sm font-medium">
                {f.label}
              </label>
              {f.kind === "text" ? (
                <Input
                  id={`tpl-${f.id}`}
                  value={values[f.id] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                />
              ) : (
                <Textarea
                  id={`tpl-${f.id}`}
                  value={values[f.id] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                  rows={3}
                  className="resize-y"
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-2">
          {existing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : existing ? (
              "Save changes"
            ) : (
              "Save instance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
