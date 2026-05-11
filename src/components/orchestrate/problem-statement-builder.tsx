"use client";

/**
 * ProblemStatementBuilder — AI-drafted, human-editable problem framing.
 *
 * Purpose: turn discovery evidence into a single, sharable problem
 * statement (who / what / why / impact + full statement). The user can
 * always override the AI's draft in the editable fields; persistent
 * "always do this" feedback lives in the AiFeedback box on the tab.
 */

import { useEffect, useState } from "react";
import { History, Loader2, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Discovery, ProblemStatementVersion } from "@/types/core";
import { api } from "@/lib/api";

interface ProblemStatementBuilderProps {
  discoveryId: string;
  activeDiscovery: Discovery | null;
}

export function ProblemStatementBuilder({
  discoveryId,
  activeDiscovery,
}: ProblemStatementBuilderProps) {
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [impact, setImpact] = useState("");
  const [statementText, setStatementText] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const [psVersions, setPsVersions] = useState<ProblemStatementVersion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!discoveryId) return;
    api.problemStatements
      .list(discoveryId)
      .then((versions) => {
        setPsVersions(versions);
        if (versions.length > 0) {
          const latest = versions[versions.length - 1];
          setWho(latest.who);
          setWhat(latest.what);
          setWhy(latest.why);
          setImpact(latest.impact);
          setStatementText(latest.statement);
        }
      })
      .catch(() => {
        /* non-critical */
      });
  }, [discoveryId]);

  useEffect(() => {
    if (psVersions.length > 0) return;
    const ps = activeDiscovery?.problem_statement;
    if (ps) {
      setWho(ps.who || "");
      setWhat(ps.what || "");
      setWhy(ps.why || "");
      setImpact(ps.impact || "");
      if (ps.statement) setStatementText(ps.statement);
    }
  }, [activeDiscovery?.id, activeDiscovery?.problem_statement, psVersions.length]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.problemStatements.generate({
        discovery_id: discoveryId,
        user_instructions: userInstructions || undefined,
      });
      setPsVersions((prev) => [...prev, result]);
      setWho(result.who);
      setWhat(result.what);
      setWhy(result.why);
      setImpact(result.impact);
      setStatementText(result.statement);
      setUserInstructions("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate problem statement");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    const id = activeDiscovery?.id;
    if (!id) return;
    setSaving(true);
    try {
      await api.discoveries.update(id, {
        problem_statement: {
          who,
          what,
          why,
          impact,
          statement: statementText,
          confidence: "assumed",
        },
      } as Partial<Discovery>);
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  const loadVersion = (v: ProblemStatementVersion) => {
    setWho(v.who);
    setWhat(v.what);
    setWhy(v.why);
    setImpact(v.impact);
    setStatementText(v.statement);
    setHistoryOpen(false);
  };

  const regenerateWithEdits = () => {
    setUserInstructions(
      `Incorporate these edits — Who: ${who}; What: ${what}; Why: ${why}; Impact: ${impact}`,
    );
    void generate();
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="text-xs text-muted-foreground">
          AI synthesizes your evidence, transcripts, and questions into a problem statement. Add
          a directive below to steer this generation; persistent feedback lives in the box at the
          bottom of the tab.
        </p>
        <Textarea
          value={userInstructions}
          onChange={(e) => setUserInstructions(e.target.value)}
          placeholder="Optional steer for this generation — e.g. 'Focus on the ops team pain'"
          rows={2}
          className="text-sm"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {psVersions.length > 0 ? (
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <History className="h-3 w-3" />
              v{psVersions.length} · history
            </button>
          ) : (
            <span />
          )}
          <Button onClick={() => void generate()} disabled={generating} size="sm">
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : psVersions.length > 0 ? (
              "Regenerate"
            ) : (
              "Generate"
            )}
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>

      {historyOpen && psVersions.length > 0 && (
        <ScrollArea className="max-h-60 space-y-1">
          <ul className="space-y-1">
            {[...psVersions].reverse().map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => loadVersion(v)}
                  className="group flex w-full cursor-pointer items-start gap-2 border-l-2 border-muted py-1 pl-2.5 text-left text-xs transition-colors hover:border-brand/60"
                >
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    v{v.version}
                  </Badge>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block truncate text-muted-foreground group-hover:text-foreground">
                      {v.statement}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      {statementText && (
        <section className="space-y-1 border-l-2 border-brand/60 pl-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Full statement{psVersions.length > 0 && ` · v${psVersions.length}`}
            </p>
            <Pencil className="h-3 w-3 text-muted-foreground" aria-hidden />
          </div>
          <Textarea
            value={statementText}
            onChange={(e) => setStatementText(e.target.value)}
            rows={4}
            className="resize-y text-sm font-medium leading-relaxed"
          />
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Who is affected?">
          <Textarea
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="e.g. Portfolio managers executing trades across 3 asset classes"
            rows={2}
            className="text-sm"
          />
        </Field>
        <Field label="What do they need?">
          <Textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="e.g. Real-time portfolio exposure without system switching"
            rows={2}
            className="text-sm"
          />
        </Field>
        <Field label="Why? (root cause)">
          <Textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="e.g. Manual cross-referencing of 3 separate ledgers"
            rows={2}
            className="text-sm"
          />
        </Field>
        <Field label="Impact if solved">
          <Textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="e.g. Reconciliation errors drop 60%, analysts save 2 hr/day"
            rows={2}
            className="text-sm"
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        {(who || what) && (
          <Button
            type="button"
            onClick={regenerateWithEdits}
            disabled={generating}
            variant="outline"
            size="sm"
          >
            Regenerate with my edits
          </Button>
        )}
        <Button onClick={() => void save()} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

