"use client";

/**
 * CritiqueChip — terse summary of a critique on an artifact card.
 *
 * Renders the headline score + blocker/warn counts as shadcn badges so
 * the colors track the theme tokens rather than introducing raw palette
 * colors. The expanded issue list is exported separately for use inside
 * the artifact-detail modal.
 */

import { Badge } from "@/components/ui/badge";
import type {
  SynthesisCritique,
  SynthesisCritiqueIssue,
} from "@/types/synthesis";

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

function scoreVariant(
  score: number,
): "default" | "secondary" | "destructive" {
  if (score >= 0.75) return "default";
  if (score >= 0.5) return "secondary";
  return "destructive";
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
      <Badge variant={scoreVariant(critique.score)}>score {score}</Badge>
      {blockers > 0 && (
        <Badge variant="destructive">
          {blockers} blocker{blockers > 1 ? "s" : ""}
        </Badge>
      )}
      {warns > 0 && (
        <Badge variant="secondary">
          {warns} warning{warns > 1 ? "s" : ""}
        </Badge>
      )}
      {!compact && issues.length === 0 && (
        <Badge variant="outline">no issues</Badge>
      )}
    </div>
  );
}

export function CritiqueIssueList({
  critique,
}: {
  critique: SynthesisCritique | null;
}) {
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
