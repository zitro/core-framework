"use client";

/**
 * UseCaseBuilder — AI-drafted, iteratively-refined use case.
 *
 * Purpose: turn the discovery's evidence + transcripts + working
 * material into a single structured use case (persona, goal, current/
 * desired state, business value, impact, metrics, summary). One latest
 * version is always shown; older versions collapse into history.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UseCaseVersion } from "@/types/core";
import { api } from "@/lib/api";

interface UseCaseBuilderProps {
  discoveryId: string;
}

export function UseCaseBuilder({ discoveryId }: UseCaseBuilderProps) {
  const [versions, setVersions] = useState<UseCaseVersion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!discoveryId) return;
    try {
      const items = await api.useCases.list(discoveryId);
      setVersions(items);
    } catch {
      /* non-critical */
    }
  }, [discoveryId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.useCases.generate({
        discovery_id: discoveryId,
        user_instructions: instructions || undefined,
      });
      setVersions((prev) => [...prev, result]);
      setInstructions("");
    } catch {
      /* toast handled by api */
    } finally {
      setGenerating(false);
    }
  };

  const latest = versions.length > 0 ? versions[versions.length - 1] : null;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="text-xs text-muted-foreground">
          AI distills evidence, transcripts, and docs into a structured use case with business
          value and impact. Add a directive below to steer this generation; persistent feedback
          lives in the box at the bottom of the tab.
        </p>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Optional steer for this generation — e.g. 'Focus on the compliance reporting pain' or 'Target the portfolio manager persona'"
          rows={2}
          className="text-sm"
        />
        <div className="flex items-center justify-end">
          <Button onClick={() => void generate()} disabled={generating} size="sm">
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : latest ? (
              "Regenerate"
            ) : (
              "Generate use case"
            )}
          </Button>
        </div>
      </section>

      {latest && (
        <section className="space-y-4 border-l-2 border-brand/60 pl-4">
          <header className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-semibold">
                {latest.title || "Use Case"}
              </h3>
              <Badge variant="secondary" className="text-[10px]">
                v{latest.version}
              </Badge>
            </div>
            {latest.persona && (
              <p className="text-xs text-muted-foreground">{latest.persona}</p>
            )}
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Goal">{latest.goal}</Field>
            <Field label="Current state">{latest.current_state}</Field>
            <Field label="Desired state">{latest.desired_state}</Field>
            <Field label="Business value">{latest.business_value}</Field>
            <Field label="Business impact" className="md:col-span-2">
              {latest.business_impact}
            </Field>
          </div>

          {latest.success_metrics.length > 0 && (
            <Field label="Success metrics">
              <ul className="mt-0.5 space-y-0.5">
                {latest.success_metrics.map((m, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-muted py-0.5 pl-2.5 text-xs leading-relaxed"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </Field>
          )}

          {latest.summary && (
            <Field label="Summary">
              <p className="whitespace-pre-line text-sm leading-relaxed">{latest.summary}</p>
            </Field>
          )}
        </section>
      )}

      {versions.length > 1 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Version history ({versions.length})
          </button>
          {historyOpen && (
            <ul className="space-y-1">
              {[...versions].reverse().map((v) => (
                <li
                  key={v.id}
                  className="border-l-2 border-muted py-0.5 pl-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      v{v.version} · {v.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">{v.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
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
    <div className={["space-y-1", className].filter(Boolean).join(" ")}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
