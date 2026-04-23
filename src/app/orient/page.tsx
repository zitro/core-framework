"use client";

/**
 * /orient — Engagement Brief.
 *
 * v2.2 stub: shows the engagement context (typed schema landing in B4)
 * as a structured brief. Phase D2 fills this with the real form +
 * markdown projection toggle. For now we render an empty-state that
 * points users to the new model.
 */

import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrientPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Compass className="h-6 w-6 text-amber-500" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Orient</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Frame the engagement: the problem you&apos;re solving, the desired
          outcome, scope, stakeholders, risks, and success metrics. The brief
          here grounds every AI call across Refine and Execute.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Engagement Brief</CardTitle>
          <CardDescription>
            Coming next: a single editable form backed by the typed
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              EngagementContext
            </code>
            record, with a one-click projection to
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              engagement-brief.md
            </code>
            in the connected vertex source.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link href="/capture">
            <Button variant="default" className="w-full sm:w-auto">
              Start in Capture
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings?tab=engagement">
            <Button variant="outline" className="w-full sm:w-auto">
              Configure context
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
