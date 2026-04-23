"use client";

import { useState } from "react";
import { RefreshCw, ChevronDown, ChevronRight, Mail, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CritiqueChip,
  CritiqueIssueList,
} from "@/components/synthesis/critique-chip";
import { StoryboardFrames } from "@/components/synthesis/storyboard-frames";
import type { SynthesisArtifact } from "@/lib/api-synthesis";

interface Props {
  artifact: SynthesisArtifact;
  onRegenerate: (typeId: string) => Promise<void> | void;
  onUpdate?: (updated: SynthesisArtifact) => void;
  busy?: boolean;
}

function renderBodyValue(value: unknown): React.ReactNode {
  if (value == null || value === "") return <em className="text-muted-foreground">empty</em>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <em className="text-muted-foreground">empty</em>;
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((v, i) => (
          <li key={i}>{renderBodyValue(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}

export function ArtifactCard({ artifact, onRegenerate, onUpdate, busy }: Props) {
  const [open, setOpen] = useState(false);
  const bodyEntries = Object.entries(artifact.body || {});
  const isStoryboard = artifact.type_id === "storyboard";

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{artifact.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{artifact.type_id}</Badge>
              <span>v{artifact.version}</span>
              <span>· {artifact.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {artifact.type_id === "weekly-email-update" && (
              <EmailActions artifact={artifact} />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRegenerate(artifact.type_id)}
              disabled={busy}
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Regenerate
            </Button>
          </div>
        </div>
        <CritiqueChip critique={artifact.critique} />
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {artifact.summary && (
          <p className="leading-relaxed">{artifact.summary}</p>
        )}

        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          Details, citations & critique
        </button>

        {open && (
          <div className="space-y-4 pt-2 border-t">
            {isStoryboard && onUpdate && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Frames
                </div>
                <StoryboardFrames artifact={artifact} onUpdate={onUpdate} />
              </div>
            )}
            {!isStoryboard && bodyEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Body
                </div>
                <dl className="space-y-2">
                  {bodyEntries.map(([k, v]) => (
                    <div key={k} className="space-y-1">
                      <dt className="text-xs font-medium">{k}</dt>
                      <dd>{renderBodyValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {artifact.citations.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Citations
                </div>
                <ul className="space-y-1.5 text-xs">
                  {artifact.citations.map((c, i) => (
                    <li key={i} className="flex flex-col gap-0.5">
                      <code className="text-xs">{c.source_id}</code>
                      {c.quote && (
                        <span className="text-muted-foreground">
                          “{c.quote}”
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {artifact.critique && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Critic findings
                </div>
                <CritiqueIssueList critique={artifact.critique} />
              </div>
            )}
          </div>
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
  const parts = [
    get("greeting"),
    get("body"),
    get("signoff"),
  ].filter(Boolean);
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
      <Button size="sm" variant="ghost" onClick={onCopy} title="Copy email text">
        <Copy className="size-3.5" />
      </Button>
      <Button size="sm" variant="outline" onClick={onMail}>
        <Mail className="size-3.5 mr-1.5" />
        Open in mail
      </Button>
    </>
  );
}
