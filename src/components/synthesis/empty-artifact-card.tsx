"use client";

/**
 * EmptyArtifactCard — placeholder slot for a catalog type that hasn't been
 * generated yet. Renders the same dimensions as ArtifactCard so categories
 * never show "missing" cards. The Generate button kicks the regenerate
 * pipeline for that type_id (which creates v1 if no artifact exists).
 */

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  typeId: string;
  typeLabel: string;
  description?: string;
  busy?: boolean;
  onGenerate: (typeId: string) => Promise<void> | void;
}

export function EmptyArtifactCard({
  typeId,
  typeLabel,
  description,
  busy,
  onGenerate,
}: Props) {
  return (
    <Card className="flex h-full flex-col border-dashed bg-muted/20">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base leading-snug text-muted-foreground">
              {typeLabel}
            </CardTitle>
            <div className="text-xs text-muted-foreground">Not generated yet</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3 text-sm">
        <p className="leading-relaxed text-muted-foreground line-clamp-4">
          {description || "Click Generate to draft this artifact from your sources."}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => onGenerate(typeId)}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 size-3.5" />
          )}
          Generate
        </Button>
      </CardContent>
    </Card>
  );
}
