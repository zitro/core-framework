"use client";

import { Badge } from "@/components/ui/badge";
import type {
  SynthesisCritique,
  SynthesisCritiqueIssue,
} from "@/lib/api-synthesis";

interface Props {
  critique: SynthesisCritique | null;
  compact?: boolean;
}

const SEVERITY_VARIANT: Record<
  SynthesisCritiqueIssue["severity"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  info: "outline",
  warn: "secondary",
  blocker: "destructive",
};

function scoreColor(score: number): string {
  if (score >= 0.75) return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (score >= 0.5) return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-rose-500/15 text-rose-700 border-rose-500/30";
}

export function CritiqueChip({ critique, compact }: Props) {
  if (!critique) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        not yet critiqued
      </Badge>
    );
  }

  const score = Math.round(critique.score * 100);
  const issues = critique.issues ?? [];
  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const warns = issues.filter((i) => i.severity === "warn").length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className={`border ${scoreColor(critique.score)}`}>
        score {score}
      </Badge>
      {blockers > 0 && (
        <Badge variant="destructive">{blockers} blocker{blockers > 1 ? "s" : ""}</Badge>
      )}
      {warns > 0 && (
        <Badge variant="secondary">{warns} warning{warns > 1 ? "s" : ""}</Badge>
      )}
      {!compact && issues.length === 0 && (
        <Badge variant="outline" className="text-emerald-700">
          no issues
        </Badge>
      )}
    </div>
  );
}

export function CritiqueIssueList({ critique }: { critique: SynthesisCritique | null }) {
  if (!critique || !critique.issues?.length) return null;
  return (
    <ul className="space-y-1.5 text-sm">
      {critique.issues.map((issue, idx) => (
        <li
          key={`${critique.id}-${idx}`}
          className="flex items-start gap-2 leading-snug"
        >
          <Badge
            variant={SEVERITY_VARIANT[issue.severity]}
            className="shrink-0 uppercase tracking-wide text-[10px]"
          >
            {issue.severity}
          </Badge>
          <span>
            <span className="text-muted-foreground">[{issue.dimension}]</span>{" "}
            {issue.message}
            {issue.field ? (
              <span className="text-muted-foreground"> · {issue.field}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
