"use client";

import { Database, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SynthesisSources } from "@/lib/api-synthesis";

interface Props {
  sources: SynthesisSources | null;
}

const PLACEHOLDER_PATTERN = /^[\s\-\u2014_.]+$/;
function isUsefulLabel(v: string | null | undefined): boolean {
  if (!v) return false;
  const trimmed = v.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERN.test(trimmed);
}

export function SourcesPanel({ sources }: Props) {
  const docs = (sources?.docs ?? []).filter(
    (d) => isUsefulLabel(d.title) || isUsefulLabel(d.snippet) || isUsefulLabel(d.uri),
  );
  const hiddenCount = (sources?.docs.length ?? 0) - docs.length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Sources</CardTitle>
        </div>
        {sources && (
          <p className="text-xs text-muted-foreground">
            {sources.doc_count} document{sources.doc_count === 1 ? "" : "s"} ·
            built {new Date(sources.built_at).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {!sources ? (
          <p className="text-muted-foreground">No corpus loaded yet.</p>
        ) : docs.length === 0 ? (
          <p className="text-muted-foreground">
            No labelled source documents. Configure a vertex repo path or a
            connector below to enrich the corpus.
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.slice(0, 50).map((d) => {
              const title = isUsefulLabel(d.title) ? d.title : d.id;
              return (
                <li key={d.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {d.kind}
                    </Badge>
                    {d.uri && isUsefulLabel(d.uri) ? (
                      <a
                        href={d.uri}
                        className="font-medium hover:underline inline-flex items-center gap-1"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {title}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="font-medium">{title}</span>
                    )}
                  </div>
                  {isUsefulLabel(d.snippet) && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {d.snippet}
                    </p>
                  )}
                </li>
              );
            })}
            {docs.length > 50 && (
              <li className="text-xs text-muted-foreground">
                + {docs.length - 50} more
              </li>
            )}
            {hiddenCount > 0 && (
              <li className="text-[11px] italic text-muted-foreground">
                {hiddenCount} unlabelled document{hiddenCount === 1 ? "" : "s"} hidden
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
