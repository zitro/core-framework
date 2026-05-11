"use client";

/**
 * QuestionsPanel — displays open "questions worth asking" surfaced by
 * the question agent. Refresh is user-triggered; parent owns loading.
 */

import { RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SynthesisQuestion } from "@/types/synthesis";

interface Props {
  questions: SynthesisQuestion[];
  onRefresh: () => Promise<void> | void;
  busy?: boolean;
}

export function QuestionsPanel({ questions, onRefresh, busy }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle className="font-heading text-base">
            Questions worth asking
          </CardTitle>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={busy}>
          <RefreshCw className="size-3.5 mr-1.5" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open questions. Generate the synthesis first, then refresh.
          </p>
        ) : (
          <ol className="space-y-3">
            {questions.map((q) => (
              <li key={q.id} className="space-y-1">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    P{q.priority}
                  </Badge>
                  <p className="text-sm font-medium leading-snug">{q.text}</p>
                </div>
                {q.rationale && (
                  <p className="text-xs text-muted-foreground pl-9">
                    {q.rationale}
                  </p>
                )}
                {q.target_artifact_type_id && (
                  <p className="text-[11px] text-muted-foreground pl-9">
                    unblocks → <code>{q.target_artifact_type_id}</code>
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
