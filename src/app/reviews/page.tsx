"use client";

import { useEffect, useState } from "react";
import { GavelIcon, ShieldCheck, ShieldX, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { reviewsApi } from "@/lib/api-fde";
import {
  REVIEW_STATUS_LABELS,
  type Review,
  type ReviewStatus,
} from "@/types/fde";

const FILTERS: (ReviewStatus | "all")[] = [
  "all",
  "pending",
  "approved",
  "changes_requested",
  "rejected",
];

const STATUS_ICON: Record<ReviewStatus, typeof ShieldCheck> = {
  pending: Hourglass,
  approved: ShieldCheck,
  rejected: ShieldX,
  changes_requested: GavelIcon,
};

export default function ReviewsPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [comments, setComments] = useState<Record<string, string>>({});

  const reload = () =>
    reviewsApi
      .list(filter === "all" ? {} : { status: filter })
      .then(setItems)
      .catch(() => {});

  useEffect(() => {
    reload();
  }, [filter]);

  const decide = async (id: string, status: ReviewStatus) => {
    await reviewsApi.decide(id, { status, comment: comments[id] ?? "" });
    setComments((c) => ({ ...c, [id]: "" }));
    await reload();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
          <ShieldCheck className="h-5 w-5 text-rose-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground text-sm">
            Human-in-the-loop approval queue for any artifact.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : REVIEW_STATUS_LABELS[f]}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews match this filter.
          </p>
        ) : (
          items.map((r) => {
            const Icon = STATUS_ICON[r.status];
            return (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      {r.artifact_title || `${r.artifact_collection}/${r.artifact_id}`}
                    </CardTitle>
                    <Badge variant="outline" className="gap-1.5">
                      <Icon className="h-3 w-3" />
                      {REVIEW_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {r.artifact_collection} · {r.artifact_id}
                    {r.requested_by && <> · requested by {r.requested_by}</>}
                  </div>
                  {r.comment && (
                    <p className="text-muted-foreground">{r.comment}</p>
                  )}
                  {r.status === "pending" && (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        placeholder="Reviewer comment (optional)…"
                        rows={2}
                        value={comments[r.id] ?? ""}
                        onChange={(e) =>
                          setComments((c) => ({ ...c, [r.id]: e.target.value }))
                        }
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => decide(r.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(r.id, "changes_requested")}
                        >
                          Request changes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => decide(r.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
