"use client";

import { RefreshCw, Mail, Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CritiqueChip } from "@/components/synthesis/critique-chip";
import type { SynthesisArtifact } from "@/lib/api-synthesis";

interface Props {
  artifact: SynthesisArtifact;
  /** Friendly type label from the catalog (e.g. "Personas", "Workstreams"). */
  typeLabel?: string;
  /** Project name kept for legacy callers; no longer used in the title. */
  projectName?: string;
  onRegenerate: (typeId: string) => Promise<void> | void;
  onUpdate?: (updated: SynthesisArtifact) => void;
  onOpenDetail?: (artifact: SynthesisArtifact) => void;
  busy?: boolean;
}

/** Convert a slug-ish type id ("customer-pain") to a friendly label. */
function humanizeTypeId(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export function ArtifactCard({
  artifact,
  typeLabel,
  onRegenerate,
  onOpenDetail,
  busy,
}: Props) {
  const title = typeLabel || humanizeTypeId(artifact.type_id);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base leading-snug line-clamp-2">
              {title}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>v{artifact.version}</span>
              <span>· {artifact.status}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {artifact.type_id === "weekly-email-update" && (
              <EmailActions artifact={artifact} />
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRegenerate(artifact.type_id)}
              disabled={busy}
              title="Regenerate from scratch"
              aria-label="Regenerate"
            >
              <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CritiqueChip critique={artifact.critique} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-3 text-sm">
        {artifact.summary ? (
          <p className="leading-relaxed line-clamp-6">{artifact.summary}</p>
        ) : (
          <p className="italic text-muted-foreground">No summary yet.</p>
        )}

        {onOpenDetail && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => onOpenDetail(artifact)}
          >
            <MessageSquare className="mr-1.5 size-3.5" />
            Open, edit &amp; chat
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function buildEmailParts(artifact: SynthesisArtifact): {
  subject: string;
  body: string;
} {
  const body = (artifact.body ?? {}) as Record<string, unknown>;
  const get = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const subject = get("subject") || artifact.title || "Weekly update";
  const parts = [get("greeting"), get("body"), get("signoff")].filter(Boolean);
  return { subject, body: parts.join("\n\n") };
}

function EmailActions({ artifact }: { artifact: SynthesisArtifact }) {
  const onCopy = async () => {
    const { subject, body } = buildEmailParts(artifact);
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success("Email copied to clipboard");
  };
  const onMail = () => {
    const { subject, body } = buildEmailParts(artifact);
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={onCopy} title="Copy email text" aria-label="Copy email">
        <Copy className="size-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onMail} title="Open in mail" aria-label="Open in mail">
        <Mail className="size-3.5" />
      </Button>
    </>
  );
}