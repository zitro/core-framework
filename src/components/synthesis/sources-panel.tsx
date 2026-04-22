"use client";

import { Database, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SynthesisSources } from "@/lib/api-synthesis";

interface Props {
  sources: SynthesisSources | null;
}

export function SourcesPanel({ sources }: Props) {
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
        ) : sources.docs.length === 0 ? (
          <p className="text-muted-foreground">
            No source documents found. Configure a vertex repo path or local
            directory on the project.
          </p>
        ) : (
          <ul className="space-y-2">
            {sources.docs.slice(0, 50).map((d) => (
              <li key={d.id} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {d.kind}
                  </Badge>
                  {d.uri ? (
                    <a
                      href={d.uri}
                      className="font-medium hover:underline inline-flex items-center gap-1"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {d.title}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="font-medium">{d.title}</span>
                  )}
                </div>
                {d.snippet && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {d.snippet}
                  </p>
                )}
              </li>
            ))}
            {sources.docs.length > 50 && (
              <li className="text-xs text-muted-foreground">
                + {sources.docs.length - 50} more
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
