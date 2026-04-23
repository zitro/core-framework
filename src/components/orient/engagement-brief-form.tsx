"use client";

/**
 * EngagementBriefForm — typed editor for EngagementContext.
 *
 * One record per project, posted to PUT /api/engagement-context/{pid}.
 * Save persists to DB; if the user picks a writable VERTEX source, the
 * brief is also projected to engagement-brief.md inside that source.
 *
 * Local state holds an editable copy; "Save" computes a partial diff so
 * the API receives only changed fields (matches PUT EngagementContextUpdate).
 */

import { useMemo, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, type EngagementContextRecord, type EngagementPhase } from "@/lib/api";
import { StringListEditor } from "@/components/orient/string-list-editor";
import { RowsEditor, type ColumnDef } from "@/components/orient/rows-editor";

interface Props {
  initial: EngagementContextRecord;
  onSaved?: (next: EngagementContextRecord) => void;
}

const PHASES: { value: EngagementPhase; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "pilot", label: "Pilot" },
  { value: "build", label: "Build" },
  { value: "operate", label: "Operate" },
];

type Stakeholder = EngagementContextRecord["stakeholders"][number];
type Metric = EngagementContextRecord["success_metrics"][number];
type Milestone = EngagementContextRecord["milestones"][number];

const STAKEHOLDER_COLS: ColumnDef<Stakeholder>[] = [
  { key: "name", label: "Name", placeholder: "Jane Doe" },
  { key: "role", label: "Role", placeholder: "VP Engineering" },
  { key: "org", label: "Org", placeholder: "customer / internal", width: "minmax(8rem,1fr)" },
  { key: "influence", label: "Influence", placeholder: "high / med / low", width: "minmax(7rem,1fr)" },
  { key: "notes", label: "Notes", placeholder: "context" },
];

const METRIC_COLS: ColumnDef<Metric>[] = [
  { key: "name", label: "Metric", placeholder: "Time-to-insight" },
  { key: "target", label: "Target", placeholder: "≤ 24h", width: "minmax(7rem,1fr)" },
  { key: "baseline", label: "Baseline", placeholder: "current", width: "minmax(7rem,1fr)" },
  { key: "notes", label: "Notes", placeholder: "how we measure" },
];

const MILESTONE_COLS: ColumnDef<Milestone>[] = [
  { key: "label", label: "Milestone", placeholder: "Pilot kickoff" },
  { key: "target_date", label: "Target", placeholder: "2026-05-15", width: "minmax(8rem,1fr)" },
  { key: "notes", label: "Notes", placeholder: "context" },
];

const EMPTY_STAKEHOLDER: Stakeholder = { name: "", role: "", org: "", influence: "", notes: "" };
const EMPTY_METRIC: Metric = { name: "", target: "", baseline: "", notes: "" };
const EMPTY_MILESTONE: Milestone = { label: "", target_date: "", notes: "" };

export function EngagementBriefForm({ initial, onSaved }: Props) {
  const [draft, setDraft] = useState<EngagementContextRecord>(initial);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const dirty = useMemo(() => buildDiff(initial, draft), [initial, draft]);
  const hasChanges = Object.keys(dirty).length > 0;

  const set = <K extends keyof EngagementContextRecord>(
    key: K,
    val: EngagementContextRecord[K],
  ) => setDraft((d) => ({ ...d, [key]: val }));

  const draftWithAi = async () => {
    setDrafting(true);
    try {
      const res = await api.engagementContext.draft(draft.project_id);
      const proposed = res.draft ?? {};
      const merged = mergeEmpty(draft, proposed);
      const filled = Object.keys(diffApplied(draft, merged));
      setDraft(merged);
      if (filled.length === 0) {
        toast.info("Nothing to add — every field already has a value.");
      } else {
        toast.success(
          `Drafted ${filled.length} field${filled.length === 1 ? "" : "s"} from ${res.corpus_docs} source doc${res.corpus_docs === 1 ? "" : "s"}.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI draft failed");
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const next = await api.engagementContext.update(draft.project_id, dirty);
      setDraft(next);
      onSaved?.(next);
      toast.success("Engagement brief saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Headline</CardTitle>
            <p className="text-xs text-muted-foreground">
              Start with AI — it drafts every empty field from your sources.
              You stay in control of every word.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={draftWithAi}
            disabled={drafting || saving}
            className="shrink-0"
          >
            {drafting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Draft with AI
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <Input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What is this engagement called?"
            />
          </Field>
          <Field label="Phase">
            <select
              value={draft.phase}
              onChange={(e) => set("phase", e.target.value as EngagementPhase)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Engagement phase"
            >
              {PHASES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="One-liner" className="md:col-span-2">
            <Input
              value={draft.one_liner}
              onChange={(e) => set("one_liner", e.target.value)}
              placeholder="The 12-word summary you'd give in an elevator"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Problem">
            <Textarea
              value={draft.problem}
              onChange={(e) => set("problem", e.target.value)}
              rows={3}
              placeholder="What problem are we solving, and why now?"
            />
          </Field>
          <Field label="Desired outcome">
            <Textarea
              value={draft.desired_outcome}
              onChange={(e) => set("desired_outcome", e.target.value)}
              rows={3}
              placeholder="What does success look like?"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Scope — in">
              <StringListEditor
                value={draft.scope_in}
                onChange={(v) => set("scope_in", v)}
                placeholder="What's in scope"
                ariaLabel="Add in-scope item"
              />
            </Field>
            <Field label="Scope — out">
              <StringListEditor
                value={draft.scope_out}
                onChange={(v) => set("scope_out", v)}
                placeholder="What's explicitly out of scope"
                ariaLabel="Add out-of-scope item"
              />
            </Field>
            <Field label="Constraints">
              <StringListEditor
                value={draft.constraints}
                onChange={(v) => set("constraints", v)}
                placeholder="Hard constraints"
                ariaLabel="Add constraint"
              />
            </Field>
            <Field label="Assumptions">
              <StringListEditor
                value={draft.assumptions}
                onChange={(v) => set("assumptions", v)}
                placeholder="Working assumptions"
                ariaLabel="Add assumption"
              />
            </Field>
          </div>
          <Field label="Risks">
            <StringListEditor
              value={draft.risks}
              onChange={(v) => set("risks", v)}
              placeholder="Risks to watch"
              ariaLabel="Add risk"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stakeholders</CardTitle>
        </CardHeader>
        <CardContent>
          <RowsEditor<Stakeholder>
            columns={STAKEHOLDER_COLS}
            rows={draft.stakeholders}
            empty={EMPTY_STAKEHOLDER}
            onChange={(v) => set("stakeholders", v)}
            emptyHint="No stakeholders captured yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Success metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <RowsEditor<Metric>
            columns={METRIC_COLS}
            rows={draft.success_metrics}
            empty={EMPTY_METRIC}
            onChange={(v) => set("success_metrics", v)}
            emptyHint="No metrics captured yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <RowsEditor<Milestone>
            columns={MILESTONE_COLS}
            rows={draft.milestones}
            empty={EMPTY_MILESTONE}
            onChange={(v) => set("milestones", v)}
            emptyHint="No milestones captured yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            placeholder="Anything else worth knowing"
            aria-label="Free-form notes"
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border bg-background/90 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <span className="text-xs text-muted-foreground">
          {hasChanges ? `${Object.keys(dirty).length} unsaved field${Object.keys(dirty).length === 1 ? "" : "s"}` : "All changes saved"}
        </span>
        <Button onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save brief
        </Button>
      </div>
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
    <label className={`flex flex-col gap-1.5 text-sm ${className ?? ""}`}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

const SCALAR_KEYS = [
  "title",
  "one_liner",
  "phase",
  "problem",
  "desired_outcome",
  "notes",
] as const satisfies readonly (keyof EngagementContextRecord)[];

const ARRAY_KEYS = [
  "scope_in",
  "scope_out",
  "constraints",
  "assumptions",
  "risks",
  "stakeholders",
  "success_metrics",
  "milestones",
] as const satisfies readonly (keyof EngagementContextRecord)[];

function buildDiff(
  before: EngagementContextRecord,
  after: EngagementContextRecord,
): Partial<EngagementContextRecord> {
  const diff: Partial<EngagementContextRecord> = {};
  for (const k of SCALAR_KEYS) {
    if (before[k] !== after[k]) {
      (diff as Record<string, unknown>)[k] = after[k];
    }
  }
  for (const k of ARRAY_KEYS) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      (diff as Record<string, unknown>)[k] = after[k];
    }
  }
  return diff;
}

/** Fill only currently-empty fields in `current` from `proposed`. */
function mergeEmpty(
  current: EngagementContextRecord,
  proposed: Partial<EngagementContextRecord>,
): EngagementContextRecord {
  const next = { ...current } as unknown as Record<string, unknown>;
  for (const k of SCALAR_KEYS) {
    const cur = (current[k] ?? "") as string;
    const inc = proposed[k];
    if (typeof inc === "string" && inc.trim() && !cur.trim()) {
      next[k] = inc;
    }
  }
  for (const k of ARRAY_KEYS) {
    const cur = current[k] as unknown[] | undefined;
    const inc = proposed[k];
    if (Array.isArray(inc) && inc.length > 0 && (!cur || cur.length === 0)) {
      next[k] = inc;
    }
  }
  return next as unknown as EngagementContextRecord;
}

/** Subset of `next` whose values differ from `prev` (used for toast count). */
function diffApplied(
  prev: EngagementContextRecord,
  next: EngagementContextRecord,
): Partial<EngagementContextRecord> {
  return buildDiff(prev, next);
}
